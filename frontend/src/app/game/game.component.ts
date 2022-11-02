import { IonicModule } from '@ionic/angular';
import { ToastController } from '@ionic/angular';
import { AlertController } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { interval, BehaviorSubject } from 'rxjs';
import { filter, pairwise } from 'rxjs/operators';
import { timer, Subject } from 'rxjs';
import { map, takeUntil, takeWhile, finalize } from 'rxjs/operators';
import Phaser from 'phaser';

import { HttpService } from '../services/http.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent {
  phaserGame: Phaser.Game;
  config: Phaser.Types.Core.GameConfig;
  gameinfo: any = null;
  cardsinfo: any = [];
  CARDS_URL = environment.STATIC_URL;
  Ngameround = new BehaviorSubject<number>(0);

  countDownStop = new Subject<any>();
  countDownValue: number = -1;
  countDownTimer: any;

  highlightedCardSlot: number = -1;

  gameWidth: number;
  gameHeight: number;
  submittedCards: boolean = false;
  poweredDown: boolean = false;

  @ViewChild('game_div', { read: ElementRef }) game_div: ElementRef;
  @ViewChild('cards_menu', { read: ElementRef }) cards_menu: ElementRef;
  @ViewChild('tools_menu', { read: ElementRef }) tools_menu: ElementRef;
  @ViewChild('game_canvas', { read: ElementRef }) game_canvas: ElementRef;

  constructor(
    private httpService: HttpService,
    private route: ActivatedRoute,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ionViewWillEnter() {
    this.load_gameinfo().subscribe(
      (gameinfo) => {
        console.log('Game:', gameinfo);
        console.log(
          'Game_div size:',
          this.game_div.nativeElement.offsetWidth,
          this.game_div.nativeElement.offsetHeight
        );
        this.gameinfo = gameinfo;
        this.Ngameround.next(gameinfo['Ngameround']);

        this.config = {
          parent: 'piraterace-game',
          type: Phaser.CANVAS,
          transparent: true,
          canvas: this.game_canvas.nativeElement,
          width: this.gameinfo.map.width * this.gameinfo.map.tilewidth,
          height: this.gameinfo.map.height * this.gameinfo.map.tileheight,
          scale: {
            mode: Phaser.Scale.NONE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            autoRound: true,
          },
          physics: { default: 'None' },
          fps: {
            target: 12,
            forceSetTimeOut: true,
          },
          disableContextMenu: true,
        };

        this.config.scene = new GameScene(this);
        this.phaserGame = new Phaser.Game(this.config);

        this.cards_menu.nativeElement.style.borderColor =
          gameinfo['players'][gameinfo['me']]['color'];
        this.tools_menu.nativeElement.style.borderColor =
          gameinfo['players'][gameinfo['me']]['color'];
        this.game_canvas.nativeElement.style.borderColor =
          gameinfo['players'][gameinfo['me']]['color'];
      },
      (err) => console.error(err),
      () => console.log('observable complete')
    );
    this.getPlayerCards();
    this.Ngameround.asObservable()
      .pipe(
        pairwise(),
        filter((vals) => vals[0] !== vals[1])
      )
      .subscribe((val) => {
        this.countDownStop.next();
        this.submittedCards = false;
        if (this.gameinfo.players[this.gameinfo.me]['powered_down']) {
          this.submittedCards = true;
        }
        this.poweredDown = false;
        this.getPlayerCards();
      });
  }

  finalizeCountDown() {
    this.countDownValue = -1;
    this.countDownTimer = 0;
    console.log('Finalize Countdown');
  }

  setupCountDown(start: number, end: number) {
    this.countDownValue = start / end;
    const updatefreq = 500;
    this.countDownTimer = timer(0, updatefreq).pipe(
      takeUntil(this.countDownStop),
      takeWhile((_) => this.countDownValue < 1),
      finalize(() => this.finalizeCountDown()),
      map((_) => {
        console.log('time increment', this.countDownValue);
        this.countDownValue =
          this.countDownValue + (1 / (end - start)) * (updatefreq / 1000);
        return this.countDownValue; // [0,1] for progressbar
      })
    );
  }

  ionViewWillLeave() {
    this.phaserGame.destroy(true, false);
    // this.defaultScene.updateTimer.paused = true;
  }

  load_gameinfo() {
    let id = +this.route.snapshot.paramMap.get('id');
    return this.httpService.getGame(id);
  }

  getPlayerCards() {
    this.httpService.getPlayerCards().subscribe((result) => {
      this.cardsinfo = result;
    });
  }

  cardCheck(i: number) {
    if (this.gameinfo) {
      if (this.gameinfo.players[this.gameinfo.me]['powered_down']) {
        return true;
      }
      if (this.gameinfo['state'] === 'animate') {
        return true;
      }
      return i >= this.gameinfo.players[this.gameinfo.me]['health'];
    } else {
      return false;
    }
  }

  highlightCard(i: number) {
    return i === this.highlightedCardSlot;
  }

  onCardsReorder(event) {
    event.detail.complete(true);
    this.httpService
      .switchPlayerCards(event.detail.from, event.detail.to)
      .subscribe(
        (result) => {
          console.log('switch cards:', result);
          this.cardsinfo = result;
        },
        (error) => {
          console.log('failed reorder cards: ', error);
          this.presentToast(error.error.message, 'danger');
          this.cardsinfo = error.error.cards;
        }
      );
  }

  submitCards() {
    this.httpService.submitCards().subscribe(
      (ret) => {
        this.presentToast(ret, 'success');
        this.submittedCards = true;
      },
      (error) => {
        this.presentToast(error.error, 'danger');
      }
    );
  }

  powerDown() {
    this.httpService.powerDown().subscribe(
      (ret) => {
        this.poweredDown = true;
        this.presentToast(ret, 'success');
      },
      (error) => {
        this.presentToast(error.error, 'danger');
        this.poweredDown = true;
      }
    );
  }

  leaveGame() {
    this.httpService.get_leaveGame().subscribe(
      (ret) => {
        console.log('Success leave game: ', ret);
        this.presentToast(ret, 'success');
        this.router.navigate(['/lobby']);
      },
      (error) => {
        console.log('failed leave game: ', error);
        this.presentToast(error.error, 'danger');
      }
    );
  }

  async presentToast(msg, color = 'primary') {
    const toast = await this.toastController.create({
      message: msg,
      color: color,
      duration: 5000,
    });
    toast.present();
  }

  async presentSummary() {
    let winner = this.gameinfo.summary.winner;
    const alert = await this.alertController.create({
      header: 'Race finished',
      //subHeader: ''
      message: `Yo Ho Ho, turns out the mighty ${winner} is quite a Seadog and finished first!`,
      buttons: [
        {
          text: 'Okay, leave',
          handler: () => {
            this.leaveGame();
          },
        },
      ],
    });
    await alert.present();
  }
}

class GameScene extends Phaser.Scene {
  updateTimer: Phaser.Time.TimerEvent;
  animationTimer: Phaser.Time.TimerEvent;
  boats: any = {};
  last_played_action: number = 0;
  component: any = null;
  // animation config
  move_frames: number = 3; // number of sub steps of animations
  anim_frac: number = 0.5; // fraction of animation time we spend with doing things
  anim_cutoff: number = 10; // below this duration we just skip animations
  checkpointLabels: Phaser.GameObjects.Text[] = [];
  constructor(component) {
    super('MainGameScene');
    this.component = component;
  }

  preload() {
    this.load.image(
      'tileset',
      `${environment.STATIC_URL}/maps/${this.component.gameinfo.map.tilesets[0].image}`
    );
    this.load.tilemapTiledJSON(
      'tilemap',
      `${environment.STATIC_URL}/maps/${this.component.gameinfo.mapfile}`
    );
    this.load.spritesheet(
      'boat',
      `${environment.STATIC_URL}/sprites/boat.png`,
      { frameWidth: 24, frameHeight: 72 }
    );
  }

  check_player_state() {
    let valid = true;
    let GI = this.component.gameinfo;
    Object.entries(GI.players).forEach(([playerid, player]) => {
      console.log('check_player_state', player);
      let boatgrp = this.boats[playerid];
      let boat = boatgrp.getChildren()[0];
      let boat_x = Math.floor(boat.x / GI.map.tilewidth);
      let boat_y = Math.floor(boat.y / GI.map.tileheight);
      if (boat_x !== player['pos_x']) {
        console.log(
          'Error: Inconsistent boat position in x ! Should be ',
          player,
          player['pos_x'],
          ' in game: ',
          boat_x
        );
        valid = false;
      }
      if (boat_y !== player['pos_y']) {
        console.log(
          'Error: Inconsistent boat position in y ! Should be ',
          player,
          player['pos_y'],
          ' in game: ',
          boat_y
        );
        valid = false;
      }
    });
    console.log('check_player_state: ', valid);
  }

  update_healthbar(
    boat_id: number,
    damage: number,
    time: number,
    value: number = undefined
  ) {
    let bar = this.boats[boat_id].getChildren()[2];
    this.animationTimer = this.time.addEvent({
      callback: () => {
        if (value) {
          bar.setHealth(value);
        } else {
          bar.decrease(damage);
        }
      },
      callbackScope: this,
      delay: time, // 1000 = 1 second
      repeat: 0,
    });
  }

  flush_down_boat(boat_id: number, time: number) {
    let GI = this.component.gameinfo;
    let GIplayer = this.component.gameinfo.players[boat_id];
    time *= this.anim_frac;
    let N = 8;
    let frame_delay = time / N;
    let angle = (2 * Math.PI) / N;
    let boat = this.boats[boat_id];
    if (frame_delay < this.anim_cutoff) {
    } else {
      this.animationTimer = this.time.addEvent({
        callback: () => {
          boat.scaleXY(-1 / N, -1 / N);
          boat.rotate(angle);
        },
        callbackScope: this,
        delay: frame_delay, // 1000 = 1 second
        repeat: N - 1,
      });
    }
  }

  getTileX(tileidx: number): number {
    return +this.component.gameinfo.map.tilewidth * (tileidx + 0.5);
  }
  getTileY(tileidx: number): number {
    return +this.component.gameinfo.map.tileheight * (tileidx + 0.5);
  }

  play_actionstack(animation_time_ms: number) {
    let GI = this.component.gameinfo;
    let actionstack = this.component.gameinfo.actionstack;

    console.log(
      'this.last_played_action',
      this.last_played_action,
      actionstack.length
    );

    if (this.component.gameinfo.actionstack.length <= this.last_played_action) {
      return;
    }

    // let tm = new Phaser.Tweens.TweenManager(this);
    console.log('Animation time:', animation_time_ms);
    let timeline = this.tweens.createTimeline({
      duration: animation_time_ms,
      onComplete: function () {
        this.drawCheckpoints();
        this.check_player_state();
        this.component.highlightedCardSlot = -1;
      },
      callbackScope: this,
    });
    for (let i = this.last_played_action; i < actionstack.length; i++) {
      let offset = (i - this.last_played_action) * animation_time_ms;
      let action_grp = actionstack[i];
      for (let action of action_grp) {
        console.log('Action:', action);
        if (action.key === 'rotate') {
          let boatGroup = this.boats[action.target].getChildren();
          // boat.angle += 90 * action.val;
          let targetAngle = action.to * 90;
          if (action.from == 0 && action.to == 3) {
            targetAngle = -90;
          }
          if (action.from == 3 && action.to == 0) {
            targetAngle = 360;
          }
          timeline.add({
            targets: boatGroup,
            duration: animation_time_ms,
            angle: {
              from: action.from * 90,
              to: targetAngle,
            },
            offset: offset,
          });
        } else if (action.key === 'move_x') {
          let boatGroup = this.boats[action.target].getChildren();
          timeline.add({
            targets: boatGroup,
            duration: animation_time_ms,
            x: {
              from: (action.from + 0.5) * GI.map.tilewidth,
              to: (action.to + 0.5) * GI.map.tilewidth,
            },
            offset: offset,
          });
        } else if (action.key === 'move_y') {
          let boatGroup = this.boats[action.target].getChildren();
          timeline.add({
            targets: boatGroup,
            duration: animation_time_ms,
            y: {
              from: (action.from + 0.5) * GI.map.tileheight,
              to: (action.to + 0.5) * GI.map.tileheight,
            },
            offset: offset,
          });
        } else if (action.key === 'collision_x') {
          let wiggle_delta_x = GI.map.tilewidth * 0.1;
          let nWiggles = 4;
          let boatGroup = this.boats[action.target].getChildren();
          timeline.add({
            targets: boatGroup,
            x: function (target, key, value) {
              return value + action.val * wiggle_delta_x;
            },
            offset: offset,
            duration: animation_time_ms / (nWiggles * 2),
            yoyo: true,
            repeat: nWiggles,
            callbackScope: this,
            onComplete: function () {
              this.update_healthbar(action.target, action.damage, 0);
            },
          });
        } else if (action.key === 'collision_y') {
          let boatGroup = this.boats[action.target].getChildren();
          let wiggle_delta_y = GI.map.tileheight * 0.1;
          let nWiggles = 4;
          timeline.add({
            targets: boatGroup,
            y: function (target, key, value) {
              return value + action.val * wiggle_delta_y;
            },
            duration: animation_time_ms / (nWiggles * 2),
            repeat: nWiggles,
            offset: offset,
            yoyo: true,
            onComplete: function () {
              this.update_healthbar(action.target, action.damage, 0);
            },
            callbackScope: this,
          });
        } else if (action.key === 'shot') {
          let cannonball = this.add.circle(
            (action.src_x + 0.5) * GI.map.tilewidth,
            (action.src_y + 0.5) * GI.map.tilewidth,
            7,
            0
          );
          cannonball.setVisible(false);
          timeline.add({
            targets: cannonball,
            x: (action.collided_at[0] + 0.5) * GI.map.tilewidth,
            y: (action.collided_at[1] + 0.5) * GI.map.tilewidth,
            callbackScope: this,
            onStart: function (tween, target) {
              cannonball.setVisible(true);
            },
            onComplete: function (tween, target) {
              cannonball.destroy();
              if (action.other_player !== undefined) {
                this.update_healthbar(action.other_player, action.damage, 0);
              }
            },
            duration: (animation_time_ms * 2) / 3,
            offset: offset,
          });
          if (action.other_player !== undefined) {
            timeline.add(
              this.showStars(
                this.getTileX(action.collided_at[0]),
                this.getTileY(action.collided_at[1]),
                0xff0000,
                animation_time_ms / 3,
                offset + (animation_time_ms * 2) / 3
              )
            );
          }
        } else if (action.key === 'death') {
          let boatGroup = this.boats[action.target].getChildren();
          if (action.type === 'void') {
            timeline.add({
              targets: boatGroup,
              scale: '-=1',
              angle: '+=360',
              offset: offset,
            });
          } else if (action.type === 'collision') {
            timeline.add({
              targets: boatGroup,
              scale: '-=1',
              offset: offset,
            });
          } else if (action.type === 'cannon') {
            timeline.add({
              targets: boatGroup,
              scale: '-=1',
              offset: offset,
            });
          } else {
            console.log('unknown type of death: ', action.type);
          }
        } else if (action.key === 'respawn') {
          let boatGroup = this.boats[action.target].getChildren();
          timeline.add({
            targets: boatGroup,
            scale: '+=1',
            offset: offset,
            onStart: function () {
              let boatGroup = this.boats[action.target];
              boatGroup.setXY(
                this.getTileX(action.posx),
                this.getTileY(action.posy)
              );
              let pboat = boatGroup.getChildren()[0];
              pboat.setAngle(90 * action['direction']);
            },
            onComplete: function () {
              this.update_healthbar(action.target, 0, 0, action.health);
            },
            callbackScope: this,
          });
        } else if (action.key === 'repair') {
          let boatGroup = this.boats[action.target].getChildren();
          timeline.add(
            this.showStars(
              this.getTileX(action.posx),
              this.getTileY(action.posy),
              0x00ff00,
              animation_time_ms,
              offset
            )
          );

          timeline.add({
            targets: boatGroup,
            offset: offset,
            onComplete: function () {
              this.update_healthbar(action.target, -action.val, 0);
            },
            callbackScope: this,
          });
        } else if (action.key === 'card_is_played') {
          if (action.target === this.component.gameinfo.me) {
            let boatGroup = this.boats[action.target].getChildren();
            timeline.add({
              targets: boatGroup,
              offset: offset,
              onComplete: function () {
                this.component.highlightedCardSlot = action.cardslot;
              },
              callbackScope: this,
            });
          }
        } else if (action.key === 'powerdownrepair') {
          let boatGroup = this.boats[action.target].getChildren();
          timeline.add({
            targets: boatGroup,
            offset: offset,
            duration: 0,
            onComplete: function () {
              this.update_healthbar(action.target, 0, 0, action.health);
            },
            callbackScope: this,
          });
        } else if (action.key === 'win') {
          let boatGroup = this.boats[action.target].getChildren();
          timeline.add({
            targets: boatGroup,
            offset: offset,
            duration: 0,
            onComplete: function () {
              this.updateTimer.paused = true;
              this.component.presentSummary();
            },
            callbackScope: this,
          });
        } else {
          console.log('Error, key not found.');
        }
      }
    }

    console.log('Timeline: ', timeline);
    timeline.play();
    this.last_played_action = actionstack.length;
  }

  showStars(x, y, color, duration, offset) {
    let stars = this.add.group();
    stars.add(this.add.star(x - 2, y + 6, 5, 6, 11, color));
    stars.add(this.add.star(x - 5, y - 11, 5, 8, 13, color));
    stars.setVisible(false);
    return {
      targets: stars,
      offset: offset,
      y: '+= GI.map.tileheight/2',
      onStart: function (tween, target) {
        stars.setVisible(true);
      },
      onComplete: function (tween, target) {
        stars.clear(true, true);
      },
      callbackScope: this,
      duration: duration,
    };
  }

  create() {
    let GI = this.component.gameinfo;

    // create the Tilemap
    const map = this.make.tilemap({
      key: 'tilemap',
      tileWidth: GI.map.tilewidth,
      tileHeight: GI.map.tileheight,
    });

    // add the tileset image we are using
    const tileset = map.addTilesetImage(GI.map.tilesets[0].name, 'tileset');

    // create the layers we want in the right order
    map.createLayer(GI.map.layers[0].name, tileset, 0, 0);

    this.drawGrid();
    this.drawCheckpoints();

    Object.entries(GI.players).forEach(([playerid, player]) => {
      let color = Phaser.Display.Color.HexStringToColor(player['color']);
      let backdrop = this.add.rectangle(
        (player['pos_x'] + 0.5) * GI.map.tilewidth,
        (player['pos_y'] + 0.5) * GI.map.tileheight,
        GI.map.tilewidth,
        GI.map.tileheight,
        color.color,
        0.75
      );

      var boat = this.add.sprite(
        (player['pos_x'] + 0.5) * GI.map.tilewidth,
        (player['pos_y'] + 0.5) * GI.map.tileheight,
        'boat'
      );
      //set the width of the sprite
      boat.displayHeight = GI.map.tileheight * 1.1;
      //scale evenly
      boat.scaleX = boat.scaleY;
      boat.angle = player['direction'] * 90;

      let hp = new HealthBar(
        this,
        (player['pos_x'] + 0.5) * GI.map.tilewidth,
        (player['pos_y'] + 0.5) * GI.map.tileheight,
        GI.map.tilewidth * 0.8,
        GI.map.tileheight * 0.12,
        player['health']
      );

      let group = this.add.group();
      group.add(boat);
      group.add(backdrop);
      group.add(hp);
      this.boats[playerid] = group;
    });

    // camera draggable, start on player boat
    var cam = this.cameras.main;
    var myBoat = this.boats[GI.me].getChildren()[0];
    // would be nice to have camera respect bounds, but tests with responsive mode not successful
    cam.centerOn(myBoat.x, myBoat.y);
    //cam.setBounds(0, 0, GI.map.tilewidth * GI.map.width, GI.map.tileheight * GI.map.height);

    this.input.on('pointermove', function (p) {
      if (!p.isDown) return;

      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });

    //this.play_actionstack(20); // play the first action stack really quickly in case user does a reload
    // Object.entries(GI.players).forEach(([playerid, player]) => {
    //   this.boats[playerid].setX(this.getTileX(player['pos_x']));
    //   this.boats[playerid].setY(this.getTileY(player['pos_y']));
    //   this.boats[playerid].rotate((player['direction'] * Math.PI) / 2);
    //   this.update_healthbar(+playerid, 0, 0, player['health']);
    // });
    this.last_played_action = this.component.gameinfo.actionstack.length;
    // TODO: now because we dont play all acions after reload, the win condition may never be played... need to talk to Al about this...

    this.updateTimer = this.time.addEvent({
      callback: this.updateEvent,
      callbackScope: this,
      delay: 1000, // 1000 = 1 second
      loop: true,
    });
  }

  drawCheckpoints(): void {
    for (let text of this.checkpointLabels) {
      text.destroy();
    }
    this.checkpointLabels = [];
    let GI = this.component.gameinfo;
    let next_cp = GI.players[GI.me]['next_checkpoint'];
    Object.entries(GI.checkpoints).forEach(([name, pos]) => {
      let color = 'white';
      if (name < next_cp) {
        color = 'green';
      } else if (name == next_cp) {
        color = 'red';
      }
      let num = this.add.text(
        (pos[0] + 0.5) * GI.map.tilewidth,
        (pos[1] + 0.5) * GI.map.tileheight,
        name,
        {
          fontSize: '30px',
          strokeThickness: 5,
          stroke: color,
          color: color,
        }
      );
      num.setOrigin(0.5, 0.5);
      this.checkpointLabels.push(num);
    });
  }

  drawGrid(color = 0x000000, alpha = 0.2): void {
    let GI = this.component.gameinfo;
    console.log(GI);
    const Nx = GI.map.width;
    const Ny = GI.map.height;
    const maxX = GI.map.tilewidth * Nx; // FJ: no idea why the 2 is here
    const maxY = GI.map.tileheight * Ny; // FJ: no idea why the 2 is here

    for (let i = 0; i < Ny; i++) {
      //horizontal lines
      const y = i * GI.map.tileheight;
      this.add.line(maxX * 0.5, y, 0, 0, maxX, 0, color, alpha);
    }
    for (let j = 0; j < Nx; j++) {
      // vertical lines
      const x = j * GI.map.tilewidth;
      this.add.line(x, maxY * 0.5, 0, 0, 0, maxY, color, alpha);
    }
  }

  updateEvent(): void {
    this.component.load_gameinfo().subscribe((gameinfo) => {
      console.log('GameInfo ', gameinfo);
      this.component.gameinfo = gameinfo;
      this.component.Ngameround.next(gameinfo['Ngameround']);

      this.play_actionstack(gameinfo['time_per_action'] * 900);

      if (gameinfo.countdown) {
        if (this.component.countDownValue < 0) {
          this.component.setupCountDown(
            gameinfo.countdown_duration - gameinfo.countdown,
            gameinfo.countdown_duration
          );
        }
      }
    });
  }
}

class HealthBar extends Phaser.GameObjects.Container {
  value: number;
  initial_health: number;
  width: number;
  height: number;
  bar: Phaser.GameObjects.Graphics;
  scene: GameScene;
  constructor(scene, x, y, width, height, initial_health) {
    super(scene);
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.bar = this.scene.add.graphics();
    this.add(this.bar);

    this.initial_health = initial_health;
    this.value = initial_health;

    this.draw();
    this.scene.add.existing(this);
  }

  decrease(amount) {
    this.value -= amount;

    if (this.value < 0) {
      this.value = 0;
    }
    this.draw();
    return this.value === 0;
  }

  setHealth(value) {
    //console.log('Set healthbar value... from ', this.value, ' to ', value);
    this.value = value;
    this.draw();
  }

  draw() {
    this.bar.clear();
    let GI = this.scene.component.gameinfo;
    const xoffset = -GI.map.tilewidth * 0.4;
    const yoffset = GI.map.tileheight * 0.3;

    //  BG
    this.bar.fillStyle(0x000000);
    this.bar.fillRect(xoffset, yoffset, this.width, this.height);

    //  Health

    this.bar.fillStyle(0xffffff);
    this.bar.fillRect(
      xoffset + 2,
      yoffset + 2,
      this.width - 4,
      this.height - 2
    );

    console.log('initial health:', this.initial_health, 'value:', this.value);
    if (this.value <= this.initial_health * 0.3) {
      this.bar.fillStyle(0xff0000);
    } else if (this.value <= this.initial_health * 0.6) {
      this.bar.fillStyle(0xffe900);
    } else {
      this.bar.fillStyle(0x00ff00);
    }
    var d = Math.floor((this.value / this.initial_health) * (this.width - 4));
    this.bar.fillRect(xoffset + 2, yoffset + 2, d, this.height - 2);
  }
}
