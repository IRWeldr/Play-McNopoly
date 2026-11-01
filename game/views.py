import json
import subprocess
import sys
from pathlib import Path
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import MonopolyProperty, CollectedGamePiece
from .board_data import MCNOPOLY_BOARD
from .extractor import extract_from_image_path, extract_mcnopoly_stamps, clean_dotmatrix_code

BASE_DIR = Path(__file__).resolve().parent.parent

def enrich_properties(properties, all_collected):
    pieces_by_prop = {}
    for c in all_collected:
        if c.property_ref_id:
            pieces_by_prop.setdefault(c.property_ref_id, []).append(c)

    props_by_group = {}
    for p in properties:
        props_by_group.setdefault(p["color_group"], []).append(p)

    for p in properties:
        pid = p["id"]
        group = p["color_group"]
        prop_pieces = pieces_by_prop.get(pid, [])
        p["is_collected"] = len(prop_pieces) > 0
        p["redeemed_codes"] = [c.code for c in prop_pieces if c.is_redeemed]
        p["queued_codes"] = [c.code for c in prop_pieces if not c.is_redeemed]
        p["total_redeemed"] = len(p["redeemed_codes"])
        p["total_queued"] = len(p["queued_codes"])

        peers = []
        if group not in ["special"]:
            for peer in props_by_group.get(group, []):
                peer_collected = peer["id"] in pieces_by_prop
                peer_pieces = pieces_by_prop.get(peer["id"], [])
                peers.append({
                    "name": peer["name"],
                    "stamp_number": peer["stamp_number"],
                    "is_rare": peer["is_rare"],
                    "is_collected": peer_collected,
                    "codes": [cp.code for cp in peer_pieces if cp.is_redeemed],
                })
        p["peers"] = peers
        p["set_collected_count"] = sum(1 for peer in peers if peer["is_collected"])
        p["set_total_count"] = len(peers)

    completed_sets = []
    checked_groups = set()
    for p in properties:
        group = p["color_group"]
        if group not in ["special", "utility"] and group not in checked_groups:
            checked_groups.add(group)
            target_count = max(p.get("total_in_set", 3), len(p["peers"]))
            # Set is complete only if target count >= 2 and all pieces are collected
            if target_count >= 2 and p["set_collected_count"] >= target_count:
                rare_peer = next((peer for peer in p["peers"] if peer["is_rare"]), None)
                completed_sets.append({
                    "group": group,
                    "prize": p.get("prize_description") or "Major Prize",
                    "rare_piece": rare_peer["name"] if rare_peer else "Grand Prize Piece",
                    "rare_stamp": rare_peer["stamp_number"] if rare_peer else "",
                    "total_pieces": target_count,
                    "peers": p["peers"],
                })

    winning_groups = {s["group"] for s in completed_sets}
    for p in properties:
        p["is_winner_set"] = p["color_group"] in winning_groups

    return completed_sets

def mcnopoly_home(request):
    """Render interactive 40-Square Monopoly Boardroom & Staging Docket."""
    if MonopolyProperty.objects.count() == 0:
        for sq in MCNOPOLY_BOARD:
            MonopolyProperty.objects.create(
                square_id=sq["id"],
                name=sq["name"],
                color_group=sq["group"],
                stamp_number=sq.get("stamp", ""),
                is_rare=sq.get("rare", False),
                prize_description=sq.get("prize", "")
            )

    properties = list(MonopolyProperty.objects.all().values())
    collected = list(CollectedGamePiece.objects.select_related("property_ref").all())

    # Attach redeemed/queued codes and set completion peers to each square
    completed_sets = enrich_properties(properties, collected)

    # Query connected ADB devices
    try:
        adb_devices = adb_manager.list_devices()
    except Exception:
        adb_devices = []

    # Code Vault Docket: only unredeemed pieces ("Queued", "Unsure", "Rare")
    docket_pieces = [c for c in collected if not c.is_redeemed]
    docket_pieces.sort(key=lambda c: c.id, reverse=True)

    context = {
        "properties_json": json.dumps(properties),
        "collected_pieces": docket_pieces,
        "total_collected": len(collected),
        "unredeemed_count": len(docket_pieces),
        "rare_count": sum(1 for c in collected if c.property_ref and c.property_ref.is_rare),
        "redeemed_count": sum(1 for c in collected if c.is_redeemed),
        "adb_devices": adb_devices,
        "completed_sets": completed_sets,
        "completed_sets_json": json.dumps(completed_sets),
        "has_winner": len(completed_sets) > 0,
    }
    return render(request, "game/index.html", context)


@csrf_exempt
def upload_piece_photo(request):
    """
    Ingests game piece scans or camera photos using local Vision LLMs (Qwen3-VL).
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    uploaded_file = request.FILES.get("file")
    text_input = request.POST.get("text", "")

    pieces_data = []

    if uploaded_file:
        try:
            tmp_dir = BASE_DIR / "media" / "uploads"
            tmp_dir.mkdir(parents=True, exist_ok=True)
            saved_path = tmp_dir / uploaded_file.name
            with open(saved_path, "wb+") as dest:
                for chunk in uploaded_file.chunks():
                    dest.write(chunk)

            # Direct Vision LLM extraction
            pieces_data = extract_from_image_path(str(saved_path))
        except Exception as err:
            return JsonResponse({"status": "error", "message": str(err)}, status=500)
    elif text_input:
        pieces_data = extract_mcnopoly_stamps(text_input)

    saved_objects = []
    skipped_objects = []
    for pd in pieces_data:
        label = pd.get("label", "Game Piece")
        stamp_num = pd.get("stamp_number", "")
        code = clean_dotmatrix_code(pd.get("code", ""))
        piece_type = pd.get("piece_type", "property")

        # Match to official board property
        prop_match = None
        if stamp_num:
            prop_match = MonopolyProperty.objects.filter(stamp_number__iexact=stamp_num).first()
        if not prop_match:
            clean_l = label.lower().replace("#", "").strip()
            for p in MonopolyProperty.objects.all():
                if p.name.lower() in clean_l or clean_l in p.name.lower():
                    prop_match = p
                    break

        # Check if this exact 14-char code is already in our database record
        existing = CollectedGamePiece.objects.filter(code__iexact=code).first() if code else None
        if existing:
            skipped_objects.append({
                "id": existing.id,
                "label": existing.label_text,
                "code": existing.code,
                "is_redeemed": existing.is_redeemed,
                "already_exists": True,
            })
            continue

        piece = CollectedGamePiece.objects.create(
            property_ref=prop_match,
            piece_type=piece_type if not prop_match else "property",
            label_text=label,
            code=code,
            is_unsure=pd.get("piece_type") == "unsure" or len(code) != 14,
            raw_ocr_snippet=f"Uploaded photo: {uploaded_file.name if uploaded_file else 'text'}"
        )

        saved_objects.append({
            "id": piece.id,
            "label": piece.label_text,
            "code": piece.code,
            "stamp_number": prop_match.stamp_number if prop_match else "",
            "square_id": prop_match.square_id if prop_match else None,
            "property_name": prop_match.name if prop_match else "Instant Win / Prize",
            "is_rare": prop_match.is_rare if prop_match else False,
            "is_unsure": piece.is_unsure
        })

    return JsonResponse({
        "status": "success",
        "pieces": saved_objects,
        "new_count": len(saved_objects),
        "skipped_count": len(skipped_objects),
        "skipped": skipped_objects,
    })


@csrf_exempt
def update_piece(request, piece_id):
    """Manual edits to piece codes and property assignment."""
    piece = get_object_or_404(CollectedGamePiece, id=piece_id)
    if request.method == "POST":
        data = json.loads(request.body.decode("utf-8")) if request.body else request.POST
        if "label" in data:
            piece.label_text = data["label"].strip()
        if "code" in data:
            piece.code = clean_dotmatrix_code(data["code"])
        if "property_id" in data and data["property_id"]:
            prop = MonopolyProperty.objects.filter(id=data["property_id"]).first()
            piece.property_ref = prop
        piece.is_unsure = False
        piece.save()
        return JsonResponse({"status": "updated", "id": piece.id, "code": piece.code})
    return JsonResponse({"error": "POST required"}, status=405)



sys.path.append(str(BASE_DIR))
from automation.adb_manager import adb_manager

@csrf_exempt
def adb_status(request):
    """Returns connected ADB devices and current automation state."""
    status_data = adb_manager.get_status()
    return JsonResponse(status_data)

@csrf_exempt
def adb_redeem(request):
    """Trigger background automated code redemption on target device."""
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    
    data = {}
    if request.body:
        try:
            data = json.loads(request.body.decode("utf-8"))
        except Exception:
            pass
    serial = data.get("serial")
    success, msg = adb_manager.start_redemption(serial=serial)
    return JsonResponse({"success": success, "message": msg})

@csrf_exempt
def adb_estop(request):
    """Emergency Stop: immediately halts ADB automation and terminates running tasks."""
    adb_manager.estop()
    return JsonResponse({"success": True, "message": "EMERGENCY STOP EXECUTED"})

def mcnopoly_mobile(request):
    """Pocket Super AMOLED mobile dashboard optimized for Galaxy S23/S20/S8+."""
    if MonopolyProperty.objects.count() == 0:
        for sq in MCNOPOLY_BOARD:
            MonopolyProperty.objects.create(
                square_id=sq["id"],
                name=sq["name"],
                color_group=sq["group"],
                stamp_number=sq.get("stamp", ""),
                is_rare=sq.get("rare", False),
                prize_description=sq.get("prize", "")
            )

    properties = list(MonopolyProperty.objects.all().values())
    collected = list(CollectedGamePiece.objects.select_related("property_ref").all())

    completed_sets = enrich_properties(properties, collected)

    devices = adb_manager.list_devices()

    # Code Vault Docket: only unredeemed pieces ("Queued", "Unsure", "Rare")
    docket_pieces = [c for c in collected if not c.is_redeemed]
    docket_pieces.sort(key=lambda c: c.id, reverse=True)

    context = {
        "properties_json": json.dumps(properties),
        "collected_pieces": docket_pieces,
        "total_collected": len(collected),
        "rare_count": sum(1 for c in collected if c.property_ref and c.property_ref.is_rare),
        "redeemed_count": sum(1 for c in collected if c.is_redeemed),
        "unredeemed_count": len(docket_pieces),
        "adb_devices": devices,
        "completed_sets": completed_sets,
        "completed_sets_json": json.dumps(completed_sets),
        "has_winner": len(completed_sets) > 0,
    }
    return render(request, "game/mobile.html", context)

