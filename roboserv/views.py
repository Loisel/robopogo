from django.shortcuts import render

# Create your views here.
from .models import Game
from .models import Player

from django.http import HttpResponse


def index(request):
    return HttpResponse("Hello, world. You're at the serv index.")
    
def playercards(request, game_id, player_id):
    game = Game.objects.get(id=game_id)
    player = Player.objects.get(id=player_id)
    response = "You're looking at the cards of " + player.name + " : " + player.cards
    return HttpResponse(response)

def deal(request, game_id):
    game = Game.objects.get(id=game_id)
    game.deal()
    response = "The cards are dealt "
    return HttpResponse(response)