import Phaser from 'phaser'
import './style.css'

const SHIRTS = [0xe63946, 0x2a9d8f, 0xf4a261, 0x457b9d, 0x9b5de5, 0xffffff, 0x222222, 0x8ac926]
const CLUES = ['bag', 'cap', 'loiter']
const LENS = 160
const TIME_LIMIT = 90
const FREE_HINTS = 3
const HINT_X = 870
const HINT_Y = 500

class MarketScene extends Phaser.Scene {
  constructor() { super('market') }

  create() {
    this.accuracy = 100
    this.over = false
    this.hints = FREE_HINTS
    this.timeLeft = TIME_LIMIT

    // ground and road
    this.add.rectangle(480, 270, 960, 540, 0xd9c9a3)
    this.add.rectangle(480, 490, 960, 100, 0x555555)

    // five market stalls in a row
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(120 + i * 180, 120, 120, 70, 0xb5651d)
    }

    this.people = []
    this.buyers = []

    // 15 sellers: 3 at each stall
    for (let i = 0; i < 5; i++) {
      for (let k = 0; k < 3; k++) {
        const p = this.addPerson(90 + i * 180 + k * 30, 172, 0x6b3e1a)
        p.kind = 'seller'
      }
    }

    // 30 buyers who wander
    for (let i = 0; i < 30; i++) {
      const p = this.addPerson(
        Phaser.Math.Between(40, 920),
        Phaser.Math.Between(210, 420),
        Phaser.Utils.Array.GetRandom(SHIRTS)
      )
      p.kind = 'buyer'
      p.speed = Phaser.Math.Between(30, 50)
      this.newTarget(p)
      this.buyers.push(p)
    }

    // 11 runners who cross the screen
    for (let i = 0; i < 11; i++) {
      const p = this.addPerson(
        Phaser.Math.Between(40, 920),
        Phaser.Math.Between(210, 420),
        Phaser.Utils.Array.GetRandom(SHIRTS)
      )
      p.kind = 'runner'
      p.speed = Phaser.Math.Between(120, 160)
      p.dir = Math.random() < 0.5 ? 1 : -1
    }

    this.placeEnemies()

    // HUD text
    this.title = this.add.text(20, 16, 'Market (test level)', { fontSize: '22px', color: '#000' }).setDepth(900)
    this.enemyText = this.add.text(20, 44, '', { fontSize: '18px', color: '#000' }).setDepth(900)
    this.accText = this.add.text(20, 68, '', { fontSize: '18px', color: '#000' }).setDepth(900)
    this.timeText = this.add.text(20, 92, '', { fontSize: '18px', color: '#000' }).setDepth(900)

    // hint button
    this.hintBg = this.add.rectangle(HINT_X, HINT_Y, 140, 40, 0xffd23f)
      .setStrokeStyle(3, 0x000000)
      .setDepth(900)
    this.hintLabel = this.add.text(HINT_X, HINT_Y, '', {
      fontSize: '18px',
      color: '#000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(901)

    this.updateHud()

    

    // crosshair that follows the pointer
    this.cross = this.add.container(480, 270, [
      this.add.rectangle(0, 0, 22, 2, 0xc1121f),
      this.add.rectangle(0, 0, 2, 22, 0xc1121f)
    ]).setDepth(999)
    this.input.setDefaultCursor('crosshair')

    // magnifier lens: a second camera zoomed in
    this.lens = this.cameras.add(0, 0, LENS, LENS).setZoom(2.5)
    this.lensFrame = this.add.rectangle(0, 0, LENS + 4, LENS + 4)
      .setOrigin(0)
      .setStrokeStyle(3, 0x000000)
      .setDepth(1000)
    this.lens.ignore([
      this.lensFrame,
      this.title,
      this.enemyText,
      this.accText,
      this.timeText,
      this.hintBg,
      this.hintLabel
    ])
    this.moveLens({ x: 480, y: 270 })

    this.input.on('pointermove', (pointer) => this.moveLens(pointer))
    this.input.on('pointerdown', (pointer, over) => {
      this.moveLens(pointer)
      if (this.over) {
        if (over.length > 0) return
        this.scene.restart()
        return
      }
      if (this.inHintButton(pointer)) {
        this.useHint()
        return
      }
      this.shoot(pointer.x, pointer.y)
    })
  }

  inHintButton(pointer) {
    return Math.abs(pointer.x - HINT_X) <= 70 && Math.abs(pointer.y - HINT_Y) <= 20
  }

  useHint() {
    if (this.hints <= 0 || this.enemies.length === 0) return
    this.hints -= 1
    this.updateHud()

    // pick a living enemy, then offset the zone so the enemy is not dead centre
    const target = Phaser.Utils.Array.GetRandom(this.enemies)
    const zx = Phaser.Math.Clamp(target.x + Phaser.Math.Between(-45, 45), 90, 870)
    const zy = Phaser.Math.Clamp(target.y + Phaser.Math.Between(-45, 45), 170, 450)

    const zone = this.add.circle(zx, zy, 90, 0xffe066, 0.2)
      .setStrokeStyle(3, 0xffb703)
      .setDepth(800)
    this.tweens.add({
      targets: zone,
      alpha: 0,
      duration: 4000,
      onComplete: () => zone.destroy()
    })
    this.floatText(zx, zy - 100, 'An enemy is in this zone', '#7a5200')
  }

  moveLens(pointer) {
    const x = Phaser.Math.Clamp(pointer.x + 24, 0, 960 - LENS)
    const y = Phaser.Math.Clamp(pointer.y - LENS - 24, 0, 540 - LENS)
    this.lens.setPosition(x, y)
    this.lens.centerOn(pointer.x, pointer.y)
    this.lensFrame.setPosition(x - 2, y - 2)
    this.cross.setPosition(pointer.x, pointer.y)
  }

  shoot(x, y) {
    let target = null
    let best = 16
    for (const p of this.people) {
      if (p.dead) continue
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < best) {
        best = d
        target = p
      }
    }
    if (!target) return

    target.dead = true
    target.setAlpha(0.35)
    target.add(this.add.text(-6, -10, 'X', { fontSize: '16px', color: '#c1121f' }))

    if (target.isEnemy) {
      this.enemies = this.enemies.filter((e) => e !== target)
      this.floatText(target.x, target.y - 20, 'Enemy down!', '#1b7f3b')
    } else {
      this.accuracy = Math.max(0, this.accuracy - 10)
      this.floatText(target.x, target.y - 20, 'Innocent! -10%', '#c1121f')
    }

    this.updateHud()

    if (this.enemies.length === 0) this.endGame(true)
    else if (this.accuracy === 0) this.endGame(false, 'accuracy')
  }

  floatText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontSize: '16px',
      color,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(950)
    this.lens.ignore(t)
    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 1500,
      onComplete: () => t.destroy()
    })
  }

  updateHud() {
    this.enemyText.setText('Enemies left: ' + this.enemies.length)
    this.accText.setText('Accuracy: ' + this.accuracy + '%')
    this.timeText.setText('Time: ' + Math.ceil(this.timeLeft))
    this.hintLabel.setText('HINT (' + this.hints + ')')
    this.hintBg.setAlpha(this.hints > 0 ? 1 : 0.4)
  }

      endGame(win, reason) {
    this.over = true
    const hintsUsed = FREE_HINTS - this.hints
    const timeLeft = Math.ceil(this.timeLeft)
    let msg
    let shareMsg = null

    if (win) {
      const score = 1000 + this.accuracy * 10 + timeLeft * 10 - hintsUsed * 100

      let stars = 1
      if (this.accuracy >= 70 && timeLeft >= 20) stars = 2
      if (this.accuracy >= 90 && timeLeft >= 40 && hintsUsed <= 1) stars = 3

      // save the best score on this device
      let best = score
      try {
        const saved = Number(localStorage.getItem('ht-best')) || 0
        if (saved > best) best = saved
        localStorage.setItem('ht-best', String(best))
      } catch (e) {}

      shareMsg =
        'I scored ' + score + ' (' + stars + '/3 stars) on The Hidden Target. ' +
        'Can you spot every enemy in the market? ' + window.location.href

      msg =
        'LEVEL COMPLETE\n' +
        '★'.repeat(stars) + '☆'.repeat(3 - stars) + '\n\n' +
        'Score: ' + score + '\n' +
        'Accuracy: ' + this.accuracy + '%\n' +
        'Time left: ' + timeLeft + 's\n' +
        'Hints used: ' + hintsUsed + '\n' +
        'Best: ' + best + '\n\n' +
        'Click anywhere else to play again'
    } else if (reason === 'time') {
      msg = 'MISSION FAILED\nTime is up. The enemies escaped.\n\nClick to try again'
    } else {
      msg = 'MISSION FAILED\nToo many innocents hit\n\nClick to try again'
    }

    const t = this.add.text(480, 270, msg, {
      fontSize: '28px',
      color: '#fff',
      backgroundColor: '#000000cc',
      align: 'center',
      padding: { x: 24, y: 16 }
    }).setOrigin(0.5).setDepth(1100)
    this.lens.ignore(t)
    this.lens.setVisible(false)
    this.lensFrame.setVisible(false)

    if (shareMsg) {
      this.makeButton(260, 490, 'WhatsApp', () => {
        window.open('https://wa.me/?text=' + encodeURIComponent(shareMsg), '_blank')
      })
      this.makeButton(480, 490, 'Post on X', () => {
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareMsg), '_blank')
      })
      this.makeButton(700, 490, 'Copy text', (label) => {
        try {
          navigator.clipboard.writeText(shareMsg)
          label.setText('Copied!')
        } catch (e) {}
      })
    }
  }

    makeButton(x, y, label, onClick) {
    const bg = this.add.rectangle(x, y, 180, 38, 0xffffff)
      .setStrokeStyle(3, 0x000000)
      .setDepth(1200)
      .setInteractive({ useHandCursor: true })
    const txt = this.add.text(x, y, label, {
      fontSize: '18px',
      color: '#000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1201)
    bg.on('pointerdown', () => onClick(txt))
  }

  addPerson(x, y, color) {
    const body = this.add.circle(0, 0, 9, color).setStrokeStyle(2, 0x000000)
    const p = this.add.container(x, y, [body])
    p.isEnemy = false
    p.dead = false
    p.clues = []
    p.loiter = false
    p.pauseUntil = 0
    this.people.push(p)
    return p
  }

  giveClue(p, clue) {
    p.clues.push(clue)
    if (clue === 'bag') p.add(this.add.rectangle(11, 5, 9, 9, 0x111111))
    if (clue === 'cap') p.add(this.add.rectangle(0, -10, 16, 5, 0xc1121f))
    if (clue === 'loiter') p.loiter = true
  }

  placeEnemies() {
    const pool = Phaser.Utils.Array.Shuffle([...this.buyers])

    // 5 to 7 enemies, each with 2 or 3 clues
    const enemyCount = Phaser.Math.Between(5, 7)
    const enemies = pool.splice(0, enemyCount)
    for (const e of enemies) {
      e.isEnemy = true
      const n = Phaser.Math.Between(2, 3)
      const clues = Phaser.Utils.Array.Shuffle([...CLUES]).slice(0, n)
      clues.forEach((c) => this.giveClue(e, c))
    }

    // 8 innocent decoys with exactly one clue each
    const decoys = pool.splice(0, 8)
    for (const d of decoys) {
      this.giveClue(d, Phaser.Utils.Array.GetRandom(CLUES))
    }

    this.enemies = enemies
  }

  newTarget(p) {
    p.tx = Phaser.Math.Between(40, 920)
    p.ty = Phaser.Math.Between(210, 420)
  }

  update(time, delta) {
    if (this.over) return
    const dt = delta / 1000

    // countdown
    this.timeLeft -= dt
    if (this.timeLeft <= 0) {
      this.timeLeft = 0
      this.updateHud()
      this.endGame(false, 'time')
      return
    }
    this.timeText.setText('Time: ' + Math.ceil(this.timeLeft))

    for (const p of this.people) {
      if (p.dead) continue
      if (p.kind === 'buyer') {
        if (time < p.pauseUntil) continue
        const dx = p.tx - p.x
        const dy = p.ty - p.y
        const dist = Math.hypot(dx, dy)
        if (dist < 4) {
          p.pauseUntil = time + (p.loiter
            ? Phaser.Math.Between(3000, 5000)
            : Phaser.Math.Between(200, 800))
          this.newTarget(p)
        } else {
          p.x += (dx / dist) * p.speed * dt
          p.y += (dy / dist) * p.speed * dt
        }
      } else if (p.kind === 'runner') {
        p.x += p.dir * p.speed * dt
        if (p.x > 980) p.x = -20
        if (p.x < -20) p.x = 980
      }
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: 'app',
  scene: [MarketScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
})