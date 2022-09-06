import json
import os
import random

from piraterace.settings import MAPSDIR
from pigame.models import (
    DIRID2NAME,
    CARDS,
    DIRID2MOVE,
)


def switch_cards_on_hand(player, src, target):
    tmp = player.deck[player.next_card + src]
    player.deck[player.next_card + src] = player.deck[player.next_card + target]
    player.deck[player.next_card + target] = tmp
    player.save(update_fields=["deck"])


def get_cards_on_hand(player, ncards):
    if player.next_card + ncards - 1 > len(player.deck):
        remaining_cards = player.deck[player.next_card :]
        old_cards = player.deck[: player.next_card]
        random.shuffle(old_cards)
        player.deck = remaining_cards + old_cards
        player.next_card = 0
        player.save(update_fields=["next_card", "deck"])

    res = []
    for i in range(0, ncards):
        res.extend((player.id, player.deck[(player.next_card + i)]))
    return res


def determine_next_cards_played(players, ncardslots):
    r = []
    for p in players:
        r.extend(get_cards_on_hand(p, ncardslots))
    # TODO: sort by ranking...
    return r


def determine_starting_locations(initmap, players):
    for layer in initmap["layers"]:
        if layer["name"] == "startinglocs":
            positions = layer["objects"]
            break

    random.shuffle(positions)
    theight = initmap["tileheight"]
    twidth = initmap["tilewidth"]
    for n, player in enumerate(players):
        player.start_loc_x = int(positions[n]["x"] / twidth)
        player.start_loc_y = int(positions[n]["y"] / theight)
        player.start_direction = random.choice(list(DIRID2NAME.keys()))
    return players


def determine_checkpoint_locations(initmap):
    for layer in initmap["layers"]:
        if layer["name"] == "checkpoints":
            positions = layer["objects"]
            break

    theight = initmap["tileheight"]
    twidth = initmap["tilewidth"]
    checkpoints = {}
    for pos in positions:
        checkpoints[pos["name"]] = (int(pos["x"] / twidth), int(pos["y"] / theight))
    return checkpoints


def play_stack(game):
    initial_map = load_inital_map(game.mapfile)
    stack = game.cards_played
    Nrounds = game.round
    players = {p.pk: p for p in list(game.account_set.all())}

    for pk, player in players.items():
        player.direction = player.start_direction
        player.xpos = player.start_loc_x
        player.ypos = player.start_loc_y

    cardstack = list(zip(stack[::2], stack[1::2]))

    actionstack = []
    for rnd in range(Nrounds):

        stack_start = rnd * game.ncardslots * len(players)
        stack_end = (rnd + 1) * game.ncardslots * len(players)
        this_round_cards = cardstack[stack_start:stack_end]

        for playerid, card in this_round_cards:
            player = players[playerid]
            actions = get_actions_for_card(game, initial_map, players, playerid, card)
            actionstack.extend(actions)

        # add canon balls here

    return players, actionstack


def get_actions_for_card(game, gmap, players, playerid, card):
    player = players[playerid]

    actions = []
    rot = CARDS[card]["rot"]
    if rot != 0:
        actions.append(dict(key="rotate", target=playerid, val=rot))
        player.direction = (player.direction + rot) % 4

    for mov in range(abs(CARDS[card]["move"])):
        # here collisions have to happen
        inc = int(CARDS[card]["move"] / abs(CARDS[card]["move"]))

        xinc = DIRID2MOVE[player.direction][0] * inc
        yinc = DIRID2MOVE[player.direction][1] * inc

        if xinc != 0:
            actions.extend(move_player_x(game, gmap, players, player, xinc))
        if yinc != 0:
            actions.extend(move_player_y(game, gmap, players, player, yinc))
    return actions


def move_player_x(game, gmap, players, player, inc):
    actions = []
    bg = list(filter(lambda l: l["name"] == "background", gmap["layers"]))[0]
    tile_id = bg["data"][player.ypos * bg["width"] + player.xpos + inc]
    tile_props = gmap["tilesets"][0]["tiles"]
    tile_prop = next(filter(lambda p: p["id"] == tile_id, tile_props))
    if next(filter(lambda p: p["name"] == "collision", tile_prop["properties"]))["value"] == True:
        damage = next(filter(lambda p: p["name"] == "damage", tile_prop["properties"]))["value"]
        actions.append(dict(key="collision_x", target=player.pk, val=inc, damage=damage))
        return actions
    for pid, p2 in players.items():
        if (p2.xpos == player.xpos + inc) and (p2.ypos == player.ypos):
            actions.extend(move_player_x(game, gmap, players, p2, inc))
            if (p2.xpos == player.xpos + inc) and (p2.ypos == player.ypos):
                return actions
            break
    player.xpos += inc
    actions.append(dict(key="move_x", target=player.pk, val=inc))
    return actions


def move_player_y(game, gmap, players, player, inc):
    actions = []
    bg = list(filter(lambda l: l["name"] == "background", gmap["layers"]))[0]
    tile_id = bg["data"][(player.ypos + inc) * bg["width"] + player.xpos]
    tile_props = gmap["tilesets"][0]["tiles"]
    tile_prop = next(filter(lambda p: p["id"] == tile_id, tile_props))
    if next(filter(lambda p: p["name"] == "collision", tile_prop["properties"]))["value"] == True:
        damage = next(filter(lambda p: p["name"] == "damage", tile_prop["properties"]))["value"]
        actions.append(dict(key="collision_y", target=player.pk, val=inc, damage=damage))
        return actions
    for pid, p2 in players.items():
        if (p2.xpos == player.xpos) and (p2.ypos == player.ypos + inc):
            actions.extend(move_player_y(game, gmap, players, p2, inc))
            if (p2.xpos == player.xpos) and (p2.ypos == player.ypos + inc):
                return actions
            break
    player.ypos += inc
    actions.append(dict(key="move_y", target=player.pk, val=inc))
    return actions


def load_inital_map(fname):
    with open(os.path.join(MAPSDIR, fname)) as fh:
        dt = json.load(fh)
    # tl = dt.layers[0].data
    # colliding = []
    return dt


def verify_map(mapobj):
    layer_names = [l["name"] for l in mapobj["layers"]]
    err_msg = []
    if not "background" in layer_names:
        err_msg.append("No background layer in map.")
    if not "startinglocs" in layer_names:
        err_msg.append("No startinglocs layer in map.")
    else:
        slayer = list(filter(lambda l: l["name"] == "startinglocs", mapobj["layers"]))[0]
        if len(slayer["objects"]) < 1:
            err_msg.append(f"startinglocs layer has only {len(slayer['objects'])} entries.")
    tilesets = mapobj["tilesets"]
    if len(tilesets) != 1:
        err_msg.append(f"{len(tilesets)} tilesets found. Only supporting 1 tileset.")
    if "checkpoints" in layer_names:
        clayer = list(filter(lambda l: l["name"] == "checkpoints", mapobj["layers"]))[0]
        if len(clayer["objects"]) < 1:
            err_msg.append(f"checkpoints layer has only {len(clayer['objects'])} entries.")
        names = set()
        for o in clayer["objects"]:
            try:
                names.add(int(o["name"]))
            except:
                err_msg.append(f"Failed to convert checkpoint name {o['name']}, needs to be integer")
        expected_names = set(range(1, len(clayer["objects"]) + 1))
        diff = expected_names.difference(names)
        if len(diff) > 0:
            err_msg.append(f"Missing named checkpoints {diff}")
    return err_msg
