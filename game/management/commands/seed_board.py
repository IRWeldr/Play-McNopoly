from django.core.management.base import BaseCommand
from game.models import MonopolyProperty
from game.board_data import MCNOPOLY_BOARD

class Command(BaseCommand):
    help = "Seeds or resets the 40 Monopoly board spaces from MCNOPOLY_BOARD"

    def handle(self, *args, **options):
        self.stdout.write("Seeding 40 official Monopoly spaces from MCNOPOLY_BOARD...")
        count = 0
        for item in MCNOPOLY_BOARD:
            # Determine total in set based on group
            group = item.get("group", "special")
            if group in ("brown", "darkblue", "highway"):
                total_in_set = 2
            elif group in ("cyan", "pink", "orange", "red", "yellow", "green"):
                total_in_set = 3
            elif group == "railroad":
                total_in_set = 4
            else:
                total_in_set = 1

            MonopolyProperty.objects.update_or_create(
                square_id=item["id"],
                defaults={
                    "name": item["name"],
                    "color_group": group,
                    "stamp_number": item.get("stamp", ""),
                    "is_rare": item.get("rare", False),
                    "prize_description": item.get("prize", ""),
                    "total_in_set": total_in_set,
                }
            )
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {count} official board spaces."))
