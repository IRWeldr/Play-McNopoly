from django.db import models

class MonopolyProperty(models.Model):
    """The 40 official/promo Monopoly board spaces."""
    square_id = models.IntegerField(unique=True) # 0 to 39
    name = models.CharField(max_length=120)
    color_group = models.CharField(max_length=50) # brown, cyan, pink, orange, red, yellow, green, darkblue, railroad, utility, special
    stamp_number = models.CharField(max_length=20, blank=True) # e.g. "#601"
    is_rare = models.BooleanField(default=False)
    prize_description = models.CharField(max_length=255, blank=True)
    total_in_set = models.IntegerField(default=3)

    class Meta:
        ordering = ["square_id"]

    def __str__(self):
        rare_badge = "🔥 [RARE] " if self.is_rare else ""
        return f"{rare_badge}{self.name} ({self.stamp_number}) [{self.color_group}]"


class CollectedGamePiece(models.Model):
    """Individual collected game piece scanned from photos or entered manually."""
    TYPE_CHOICES = [
        ("property", "Collect & Win Property"),
        ("instant_food", "Instant Win: Food"),
        ("instant_prize", "Instant Win: Cash / Tech"),
        ("unsure", "Unsure / Flagged for Review"),
    ]

    property_ref = models.ForeignKey(MonopolyProperty, on_delete=models.SET_NULL, null=True, blank=True, related_name="collected_pieces")
    piece_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="property")
    label_text = models.CharField(max_length=200) # Raw or normalized stamp title
    code = models.CharField(max_length=50, blank=True) # e.g. "7B3-9KJ-X2M"
    is_redeemed = models.BooleanField(default=False)
    is_unsure = models.BooleanField(default=False)
    confidence_score = models.FloatField(default=1.0)
    raw_ocr_snippet = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        flag = "❓ [Unsure] " if self.is_unsure else ""
        return f"{flag}{self.label_text} [{self.code or 'No Code'}]"
