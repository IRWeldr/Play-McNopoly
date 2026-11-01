"""
board_data.py - Official Canadian 2026 Monopoly Golden Edition Board Mapping
Extracted directly from the official Monopoly Game Board PDF.
"""

MCNOPOLY_BOARD = [
    # 0 to 9: Bottom Row (Right to Left from GO)
    {
        "id": 0, "name": "GO", "type": "go",
        "group": "special", "stamp": "", "rare": False, "prize": "Collect $200"
    },
    {
        "id": 1, "name": "Rideau Canal", "type": "property",
        "group": "brown", "stamp": "#801", "rare": True, "prize": "2026 Nissan Kicks SV Premium AWD (7 available)"
    },
    {
        "id": 2, "name": "COMMUNITY CHEST", "type": "card",
        "group": "special", "stamp": "", "rare": False, "prize": "Instant Win or Draw"
    },
    {
        "id": 3, "name": "Parliament Hill", "type": "property",
        "group": "brown", "stamp": "#802", "rare": False, "prize": "2026 Nissan Kicks SV Premium AWD (7 available)"
    },
    {
        "id": 4, "name": "INCOME TAX", "type": "tax",
        "group": "special", "stamp": "", "rare": False, "prize": "Pay $200"
    },
    {
        "id": 5, "name": "Montreal Airport", "type": "railroad",
        "group": "railroad", "stamp": "#823", "rare": False, "prize": "Trip for 4 to Universal Orlando Resort (14 available)"
    },
    {
        "id": 6, "name": "Lake Louise", "type": "property",
        "group": "cyan", "stamp": "#803", "rare": False, "prize": "Choose 1 of 4 BRP Vehicles (4 available)"
    },
    {
        "id": 7, "name": "CHANCE", "type": "card",
        "group": "special", "stamp": "", "rare": False, "prize": "Promo Bonus"
    },
    {
        "id": 8, "name": "Mackenzie River", "type": "property",
        "group": "cyan", "stamp": "#804", "rare": True, "prize": "Choose 1 of 4 BRP Vehicles (4 available)"
    },
    {
        "id": 9, "name": "Lake Athabasca", "type": "property",
        "group": "cyan", "stamp": "#805", "rare": False, "prize": "Choose 1 of 4 BRP Vehicles (4 available)"
    },

    # 10 to 19: Left Column (Bottom to Top)
    {
        "id": 10, "name": "JUST VISITING / JAIL", "type": "jail",
        "group": "special", "stamp": "", "rare": False, "prize": "Safe Zone"
    },
    {
        "id": 11, "name": "Percé Rock", "type": "property",
        "group": "pink", "stamp": "#806", "rare": True, "prize": "$5,000 Ardene Gift Card (10 available)"
    },
    {
        "id": 12, "name": "Miles Canyon", "type": "property",
        "group": "pink", "stamp": "#807", "rare": False, "prize": "$5,000 Ardene Gift Card (10 available)"
    },
    {
        "id": 13, "name": "Lunenburg Harbour", "type": "property",
        "group": "pink", "stamp": "#808", "rare": False, "prize": "$5,000 Ardene Gift Card (10 available)"
    },
    {
        "id": 14, "name": "Sea to Sky Highway", "type": "property",
        "group": "highway", "stamp": "#827", "rare": False, "prize": "McD's for Life! (3 available)"
    },
    {
        "id": 15, "name": "Toronto Airport", "type": "railroad",
        "group": "railroad", "stamp": "#824", "rare": False, "prize": "Trip for 4 to Universal Orlando Resort (14 available)"
    },
    {
        "id": 16, "name": "COMMUNITY CHEST", "type": "card",
        "group": "special", "stamp": "", "rare": False, "prize": "Instant Win"
    },
    {
        "id": 17, "name": "Signal Hill", "type": "property",
        "group": "orange", "stamp": "#809", "rare": False, "prize": "Trip for 4 to NASA Kennedy Space Center (7 available)"
    },
    {
        "id": 18, "name": "Peggy's Cove", "type": "property",
        "group": "orange", "stamp": "#810", "rare": False, "prize": "Trip for 4 to NASA Kennedy Space Center (7 available)"
    },
    {
        "id": 19, "name": "Tunnels of Moose Jaw", "type": "property",
        "group": "orange", "stamp": "#811", "rare": True, "prize": "Trip for 4 to NASA Kennedy Space Center (7 available)"
    },

    # 20 to 29: Top Row (Left to Right)
    {
        "id": 20, "name": "FREE PARKING", "type": "parking",
        "group": "special", "stamp": "", "rare": False, "prize": "Jackpot / Rest Stop"
    },
    {
        "id": 21, "name": "Confederation Bridge", "type": "property",
        "group": "red", "stamp": "#812", "rare": True, "prize": "$750 Circle K Fuel Gift Card (100 available)"
    },
    {
        "id": 22, "name": "Baffin Island", "type": "property",
        "group": "red", "stamp": "#813", "rare": False, "prize": "$750 Circle K Fuel Gift Card (100 available)"
    },
    {
        "id": 23, "name": "Bay of Fundy", "type": "property",
        "group": "red", "stamp": "#814", "rare": False, "prize": "$750 Circle K Fuel Gift Card (100 available)"
    },
    {
        "id": 24, "name": "CHANCE", "type": "card",
        "group": "special", "stamp": "", "rare": False, "prize": "Promo Bonus"
    },
    {
        "id": 25, "name": "Halifax Airport", "type": "railroad",
        "group": "railroad", "stamp": "#825", "rare": False, "prize": "Trip for 4 to Universal Orlando Resort (14 available)"
    },
    {
        "id": 26, "name": "TransCan Highway", "type": "property",
        "group": "highway", "stamp": "#828", "rare": True, "prize": "McD's for Life! (3 available)"
    },
    {
        "id": 27, "name": "Algonquin Provincial Park", "type": "property",
        "group": "yellow", "stamp": "#815", "rare": False, "prize": "$5,000 Best Buy Shopping Spree (5 available)"
    },
    {
        "id": 28, "name": "Wapusk National Park", "type": "property",
        "group": "yellow", "stamp": "#816", "rare": False, "prize": "$5,000 Best Buy Shopping Spree (5 available)"
    },
    {
        "id": 29, "name": "Whistler", "type": "property",
        "group": "yellow", "stamp": "#817", "rare": True, "prize": "$5,000 Best Buy Shopping Spree (5 available)"
    },

    # 30 to 39: Right Column (Top to Bottom)
    {
        "id": 30, "name": "GO TO JAIL", "type": "gotojail",
        "group": "special", "stamp": "", "rare": False, "prize": "Direct to Breakroom"
    },
    {
        "id": 31, "name": "Robson Street", "type": "property",
        "group": "green", "stamp": "#818", "rare": False, "prize": "Career Jersey Mystery Box (10 available)"
    },
    {
        "id": 32, "name": "Sainte-Catherine Street", "type": "property",
        "group": "green", "stamp": "#819", "rare": False, "prize": "Career Jersey Mystery Box (10 available)"
    },
    {
        "id": 33, "name": "Portage & Memorial", "type": "property",
        "group": "green", "stamp": "#820", "rare": True, "prize": "Career Jersey Mystery Box (10 available)"
    },
    {
        "id": 34, "name": "COMMUNITY CHEST", "type": "card",
        "group": "special", "stamp": "", "rare": False, "prize": "Instant Win"
    },
    {
        "id": 35, "name": "Vancouver Airport", "type": "railroad",
        "group": "railroad", "stamp": "#826", "rare": True, "prize": "Trip for 4 to Universal Orlando Resort (14 available)"
    },
    {
        "id": 36, "name": "CHANCE", "type": "card",
        "group": "special", "stamp": "", "rare": False, "prize": "Promo Bonus"
    },
    {
        "id": 37, "name": "SALES TAX", "type": "tax",
        "group": "special", "stamp": "", "rare": False, "prize": "Pay $100"
    },
    {
        "id": 38, "name": "Fairmont Le Château Frontenac", "type": "property",
        "group": "darkblue", "stamp": "#821", "rare": True, "prize": "5 Million Avion Points or $50,000 Cash (6 available)"
    },
    {
        "id": 39, "name": "Niagara Falls", "type": "property",
        "group": "darkblue", "stamp": "#822", "rare": False, "prize": "5 Million Avion Points or $50,000 Cash (6 available)"
    }
]
