"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HeartIcon, Volume2, VolumeX, ArrowLeft, ArrowRight, RefreshCw } from "lucide-react"
import dynamic from "next/dynamic"

// Game constants
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 400
const PLAYER_SIZE = 30
const HEART_SIZE = 20
const OBSTACLE_SIZE = 40
const LETTER_SIZE = 35
const GRAVITY = 0.8
const JUMP_FORCE = -16
const MOVE_SPEED = 5

// Game objects
interface GameObject {
  x: number
  y: number
  width: number
  height: number
}

interface Player extends GameObject {
  velocityX: number
  velocityY: number
  onGround: boolean
}

interface Heart extends GameObject {
  collected: boolean
}

interface Obstacle extends GameObject {
  deadly?: boolean
}

// Level definitions
interface Level {
  name: string
  hearts: Omit<Heart, "collected">[]
  obstacles: Obstacle[]
  loveLetter: GameObject
  background: string
  message: string
}

const levels: Level[] = [
  {
    name: "Nível 1: Primeiros Passos",
    hearts: [
      { x: 200, y: 250, width: HEART_SIZE, height: HEART_SIZE },
      { x: 350, y: 200, width: HEART_SIZE, height: HEART_SIZE },
      { x: 500, y: 280, width: HEART_SIZE, height: HEART_SIZE },
      { x: 650, y: 220, width: HEART_SIZE, height: HEART_SIZE },
    ],
    obstacles: [
      { x: 300, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
      { x: 450, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
      { x: 600, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
    ],
    loveLetter: { x: 720, y: 280, width: LETTER_SIZE, height: LETTER_SIZE },
    background: "#87CEEB", // Sky blue
    message: "Você encontrou a primeira carta! Quer continuar nossa jornada?",
  },
  {
    name: "Nível 2: Desafios do Coração",
    hearts: [
      { x: 150, y: 250, width: HEART_SIZE, height: HEART_SIZE },
      { x: 300, y: 250, width: HEART_SIZE, height: HEART_SIZE },
      { x: 450, y: 250, width: HEART_SIZE, height: HEART_SIZE },
      { x: 600, y: 250, width: HEART_SIZE, height: HEART_SIZE },
    ],
    obstacles: [
      { x: 200, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
      { x: 350, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
      { x: 500, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
      { x: 650, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
    ],
    loveLetter: { x: 740, y: 250, width: LETTER_SIZE, height: LETTER_SIZE },
    background: "#E0B0FF", // Light purple
    message: "Segunda carta encontrada! Você está indo incrível, continue!",
  },
  {
    name: "Nível 3: Amor Eterno",
    hearts: [
      { x: 100, y: 280, width: HEART_SIZE, height: HEART_SIZE },
      { x: 250, y: 280, width: HEART_SIZE, height: HEART_SIZE },
      { x: 400, y: 280, width: HEART_SIZE, height: HEART_SIZE },
      { x: 550, y: 280, width: HEART_SIZE, height: HEART_SIZE },
      { x: 700, y: 280, width: HEART_SIZE, height: HEART_SIZE },
    ],
    obstacles: [
      { x: 180, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
      { x: 330, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
      { x: 480, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
      { x: 630, y: 310, width: OBSTACLE_SIZE, height: OBSTACLE_SIZE },
    ],
    loveLetter: { x: 740, y: 250, width: LETTER_SIZE, height: LETTER_SIZE },
    background: "#FFB6C1", // Light pink
    message: "Você chegou ao fim da jornada do meu coração — quer namorar comigo?",
  },
]

// Sound generation functions
const createAudioContext = () => {
  return new (
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  )()
}

const playJumpSound = (audioContext: AudioContext) => {
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1)

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.1)
}

const playCollectSound = (audioContext: AudioContext) => {
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.frequency.setValueAtTime(400, audioContext.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1)

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.1)
}

const playHitSound = (audioContext: AudioContext) => {
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3)

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.3)
}

const playLevelCompleteSound = (audioContext: AudioContext) => {
  const notes = [262, 330, 392, 523] // C, E, G, C
  notes.forEach((freq, index) => {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.15)

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + index * 0.15)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.15 + 0.3)

    oscillator.start(audioContext.currentTime + index * 0.15)
    oscillator.stop(audioContext.currentTime + index * 0.15 + 0.3)
  })
}

const playVictorySound = (audioContext: AudioContext) => {
  const notes = [262, 330, 392, 523, 659, 784] // C, E, G, C, E, G
  notes.forEach((freq, index) => {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.15)

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + index * 0.15)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.15 + 0.3)

    oscillator.start(audioContext.currentTime + index * 0.15)
    oscillator.stop(audioContext.currentTime + index * 0.15 + 0.3)
  })
}

// Client-only floating hearts component
const FloatingHeartsComponent = () => {
  const [heartPositions] = useState(() => {
    // Generate positions only once when component mounts
    return Array.from({ length: 8 }, (_, i) => ({
      left: (i * 12.5 + Math.sin(i) * 10 + 10) % 100, // Deterministic positioning
      top: (i * 15 + Math.cos(i) * 15 + 20) % 80,
      delay: i * 0.5, // Deterministic delay
    }))
  })

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {heartPositions.map((position, i) => (
        <div
          key={i}
          className="absolute text-pink-400 text-2xl floating-heart"
          style={{
            left: `${position.left}%`,
            top: `${position.top}%`,
            animationDelay: `${position.delay}s`,
          }}
        >
          💖
        </div>
      ))}
    </div>
  )
}

// Dynamically import the floating hearts to avoid SSR
const FloatingHearts = dynamic(() => Promise.resolve(FloatingHeartsComponent), {
  ssr: false,
})

export default function RomanticPixelGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | undefined>(undefined)
  const audioContextRef = useRef<AudioContext | undefined>(undefined)

  const [gameStarted, setGameStarted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [currentLevel, setCurrentLevel] = useState(0)
  const [gameCompleted, setGameCompleted] = useState(false)

  // Game state
  const [player, setPlayer] = useState<Player>({
    x: 50,
    y: 300,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    velocityX: 0,
    velocityY: 0,
    onGround: false,
  })

  const [hearts, setHearts] = useState<Heart[]>([])
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [loveLetter, setLoveLetter] = useState<GameObject>({ x: 0, y: 0, width: 0, height: 0 })
  const [backgroundColor, setBackgroundColor] = useState("#87CEEB")
  const [modalMessage, setModalMessage] = useState("")

  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})
  const [collectedHearts, setCollectedHearts] = useState(0)
  const [totalHearts, setTotalHearts] = useState(0)

  // Initialize level
  useEffect(() => {
    if (currentLevel < levels.length) {
      const level = levels[currentLevel]
      setHearts(level.hearts.map((heart) => ({ ...heart, collected: false })))
      setObstacles(level.obstacles)
      setLoveLetter(level.loveLetter)
      setBackgroundColor(level.background)
      setModalMessage(level.message)
      setTotalHearts(level.hearts.length)
      setCollectedHearts(0)

      // Reset player position
      setPlayer({
        x: 50,
        y: 300,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        velocityX: 0,
        velocityY: 0,
        onGround: false,
      })
    }
  }, [currentLevel])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || "ontouchstart" in window)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        audioContextRef.current = createAudioContext()
      } catch (error) {
        console.error("Failed to create audio context:", error)
      }
    }
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.code]: true }))
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.code]: false }))
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // Collision detection
  const checkCollision = (obj1: GameObject, obj2: GameObject) => {
    return (
      obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y
    )
  }

  // Game loop
  const gameLoop = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw ground
    ctx.fillStyle = "#90EE90"
    ctx.fillRect(0, 350, CANVAS_WIDTH, 50)

    // Draw clouds
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(100, 50, 60, 30)
    ctx.fillRect(110, 40, 40, 20)
    ctx.fillRect(300, 70, 80, 40)
    ctx.fillRect(310, 60, 60, 20)
    ctx.fillRect(600, 45, 70, 35)
    ctx.fillRect(610, 35, 50, 20)

    // Update player physics
    setPlayer((prevPlayer) => {
      const newPlayer = { ...prevPlayer }

      // Horizontal movement
      if (keys["ArrowLeft"] || keys["KeyA"]) {
        newPlayer.velocityX = -MOVE_SPEED
      } else if (keys["ArrowRight"] || keys["KeyD"]) {
        newPlayer.velocityX = MOVE_SPEED
      } else {
        newPlayer.velocityX = 0
      }

      // Jumping
      if ((keys["Space"] || keys["ArrowUp"] || keys["KeyW"]) && newPlayer.onGround) {
        newPlayer.velocityY = JUMP_FORCE
        newPlayer.onGround = false
        if (soundEnabled && audioContextRef.current) {
          try {
            playJumpSound(audioContextRef.current)
          } catch (error) {
            console.error("Failed to play jump sound:", error)
          }
        }
      }

      // Apply gravity
      newPlayer.velocityY += GRAVITY

      // Update position
      newPlayer.x += newPlayer.velocityX
      newPlayer.y += newPlayer.velocityY

      // Ground collision
      if (newPlayer.y + newPlayer.height >= 350) {
        newPlayer.y = 350 - newPlayer.height
        newPlayer.velocityY = 0
        newPlayer.onGround = true
      }

      // Boundary checks
      if (newPlayer.x < 0) newPlayer.x = 0
      if (newPlayer.x + newPlayer.width > CANVAS_WIDTH) {
        newPlayer.x = CANVAS_WIDTH - newPlayer.width
      }

      return newPlayer
    })

    // Check heart collisions
    setHearts((prevHearts) => {
      let heartsChanged = false
      const updatedHearts = prevHearts.map((heart) => {
        if (!heart.collected && checkCollision(player, heart)) {
          if (soundEnabled && audioContextRef.current) {
            try {
              playCollectSound(audioContextRef.current)
            } catch (error) {
              console.error("Failed to play collect sound:", error)
            }
          }
          heartsChanged = true
          return { ...heart, collected: true }
        }
        return heart
      })

      if (heartsChanged) {
        setCollectedHearts((prev) => prev + 1)
      }

      return heartsChanged ? updatedHearts : prevHearts
    })

    // Check obstacle collisions
    for (const obstacle of obstacles) {
      if (checkCollision(player, obstacle)) {
        if (soundEnabled && audioContextRef.current) {
          try {
            playHitSound(audioContextRef.current)
          } catch (error) {
            console.error("Failed to play hit sound:", error)
          }
        }

        // Reset player position
        setPlayer((prev) => ({
          ...prev,
          x: 50,
          y: 300,
          velocityX: 0,
          velocityY: 0,
          onGround: false,
        }))

        break
      }
    }

    // Check love letter collision
    if (checkCollision(player, loveLetter)) {
      if (soundEnabled && audioContextRef.current) {
        try {
          if (currentLevel === levels.length - 1) {
            playVictorySound(audioContextRef.current)
            setGameCompleted(true)
          } else {
            playLevelCompleteSound(audioContextRef.current)
          }
        } catch (error) {
          console.error("Failed to play sound:", error)
        }
      }
      setShowModal(true)
      return
    }

    // Draw player (pink square with eyes)
    ctx.fillStyle = "#FF69B4"
    ctx.fillRect(player.x, player.y, player.width, player.height)

    // Draw eyes
    ctx.fillStyle = "#000000"
    ctx.fillRect(player.x + 8, player.y + 8, 4, 4)
    ctx.fillRect(player.x + 18, player.y + 8, 4, 4)

    // Draw hearts
    hearts.forEach((heart) => {
      if (!heart.collected) {
        ctx.fillStyle = "#FF1493"
        ctx.fillRect(heart.x, heart.y, heart.width, heart.height)
        // Simple heart shape
        ctx.fillRect(heart.x + 2, heart.y - 2, 6, 6)
        ctx.fillRect(heart.x + 12, heart.y - 2, 6, 6)
        ctx.fillRect(heart.x + 4, heart.y + 4, 12, 8)
      }
    })

    // Draw obstacles with level-specific colors
    obstacles.forEach((obstacle) => {
      let obstacleColor = "#808080" // Default gray

      if (currentLevel === 0) {
        obstacleColor = "#8B4513" // Brown for level 1
      } else if (currentLevel === 1) {
        obstacleColor = "#4B0082" // Indigo for level 2
      } else if (currentLevel === 2) {
        obstacleColor = "#DC143C" // Crimson for level 3
      }

      ctx.fillStyle = obstacle.deadly ? "#FF0000" : obstacleColor
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)
    })

    // Draw love letter
    ctx.fillStyle = "#FFE4E1"
    ctx.fillRect(loveLetter.x, loveLetter.y, loveLetter.width, loveLetter.height)
    ctx.fillStyle = "#FF69B4"
    ctx.fillRect(loveLetter.x + 5, loveLetter.y + 5, 25, 2)
    ctx.fillRect(loveLetter.x + 5, loveLetter.y + 10, 20, 2)
    ctx.fillRect(loveLetter.x + 5, loveLetter.y + 15, 25, 2)
    ctx.fillRect(loveLetter.x + 5, loveLetter.y + 20, 15, 2)

    if (gameStarted && !showModal) {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }
  }, [player, hearts, keys, soundEnabled, gameStarted, showModal, obstacles, loveLetter, backgroundColor, currentLevel])

  // Start game loop
  useEffect(() => {
    if (gameStarted) {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameStarted, gameLoop])

  const startGame = () => {
    console.log("Starting game...")
    setGameStarted(true)
    setCurrentLevel(0)
    setGameCompleted(false)
    document.getElementById("game-section")?.scrollIntoView({ behavior: "smooth" })
  }

  const restartGame = () => {
    setGameStarted(false)
    setShowModal(false)
    setGameCompleted(false)
    setCurrentLevel(0)
    setShowConfetti(false)

    // Reset player to initial state
    setPlayer({
      x: 50,
      y: 300,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      velocityX: 0,
      velocityY: 0,
      onGround: false,
    })

    // Scroll back to hero section
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }, 100)
  }

  const restartLevel = () => {
    // Reset the current level
    const level = levels[currentLevel]
    setHearts(level.hearts.map((heart) => ({ ...heart, collected: false })))
    setPlayer({
      x: 50,
      y: 300,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      velocityX: 0,
      velocityY: 0,
      onGround: false,
    })
    setCollectedHearts(0)
    setShowModal(false)

    // Resume game loop
    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }

  const nextLevel = () => {
    if (currentLevel < levels.length - 1) {
      setCurrentLevel(currentLevel + 1)
      setShowModal(false)

      // Resume game loop
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }
  }

  const handleMobileControl = (action: string, isPressed = true) => {
    if (action === "left") {
      setKeys((prev) => ({ ...prev, ArrowLeft: isPressed }))
    } else if (action === "right") {
      setKeys((prev) => ({ ...prev, ArrowRight: isPressed }))
    } else if (action === "jump") {
      setKeys((prev) => ({ ...prev, Space: isPressed }))
    }
  }

  const handleModalResponse = () => {
    setShowConfetti(true)
    setTimeout(() => {
      setShowModal(false)
      setShowConfetti(false)
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-200 to-purple-300 font-mono">
      {/* Floating hearts background */}
      <FloatingHearts />

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-300 to-blue-500 opacity-50"></div>

        {/* Pixel clouds */}
        <div className="absolute top-20 left-10 w-20 h-12 bg-white opacity-80 pixel-cloud"></div>
        <div className="absolute top-32 right-20 w-24 h-14 bg-white opacity-80 pixel-cloud"></div>
        <div className="absolute top-40 left-1/3 w-16 h-10 bg-white opacity-80 pixel-cloud"></div>

        {/* Pixel sun */}
        <div className="absolute top-16 right-16 w-16 h-16 bg-yellow-400 rounded-none"></div>

        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-pink-600 mb-4 pixel-text leading-normal">
            JORNADA <span className="inline-block">DO AMOR</span> 💘
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-purple-700 mb-8 max-w-2xl">
            Uma pequena jornada para alguém que significa muito.
          </p>
          <Button
            onClick={startGame}
            type="button"
            className="bg-pink-500 hover:bg-pink-600 text-white text-xl md:text-2xl px-8 py-4 rounded-none border-4 border-pink-700 shadow-lg transform hover:scale-105 transition-transform pixel-button"
          >
            INICIAR JOGO
          </Button>
        </div>
      </section>

      {/* Game Section */}
      <section id="game-section" className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <Card className="bg-purple-100 border-4 border-purple-500 rounded-none shadow-xl p-6 max-w-4xl w-full">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-xl font-bold text-purple-700">
              <HeartIcon className="text-pink-500" />
              <span>
                Corações: {collectedHearts}/{totalHearts}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setSoundEnabled(!soundEnabled)}
                variant="outline"
                size="sm"
                className="border-2 border-purple-500 rounded-none"
              >
                {soundEnabled ? <Volume2 /> : <VolumeX />}
              </Button>
              <Button
                onClick={restartLevel}
                variant="outline"
                size="sm"
                className="border-2 border-purple-500 rounded-none"
              >
                <RefreshCw size={18} />
              </Button>
            </div>
          </div>

          <div className="text-center mb-2">
            <p className="text-lg font-bold text-purple-700">{levels[currentLevel].name}</p>
          </div>

          <div className="flex justify-center mb-4 relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="border-4 border-purple-500 bg-sky-200 max-w-full h-auto relative z-10"
              style={{ imageRendering: "pixelated" }}
            />

            {/* Mobile Play Button Overlay */}
            {isMobile && !gameStarted && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20 rounded border-4 border-purple-500">
                <Button
                  onClick={startGame}
                  type="button"
                  className="bg-pink-500 hover:bg-pink-600 text-white text-2xl px-8 py-6 rounded-none border-4 border-pink-700 shadow-lg transform hover:scale-105 transition-transform pixel-button"
                >
                  ▶️ JOGAR
                </Button>
              </div>
            )}
          </div>

          {!isMobile && !gameStarted && (
            <p className="text-center text-purple-700 mb-4">Clique &quot;INICIAR JOGO&quot; acima para começar</p>
          )}

          {gameStarted && !isMobile && (
            <p className="text-center text-purple-700 mb-4">Use as setas ← → para mover e ESPAÇO para pular</p>
          )}

          {/* Mobile Controls */}
          {isMobile && gameStarted && (
            <div className="flex justify-center gap-4 mt-4">
              <Button
                onTouchStart={() => handleMobileControl("left", true)}
                onTouchEnd={() => handleMobileControl("left", false)}
                onMouseDown={() => handleMobileControl("left", true)}
                onMouseUp={() => handleMobileControl("left", false)}
                className="bg-purple-500 hover:bg-purple-600 text-white w-16 h-16 rounded-none border-4 border-purple-700 active:scale-95 select-none"
              >
                <ArrowLeft size={24} />
              </Button>
              <Button
                onTouchStart={() => handleMobileControl("jump", true)}
                onTouchEnd={() => handleMobileControl("jump", false)}
                onMouseDown={() => handleMobileControl("jump", true)}
                onMouseUp={() => handleMobileControl("jump", false)}
                className="bg-pink-500 hover:bg-pink-600 text-white w-20 h-16 rounded-none border-4 border-pink-700 active:scale-95 text-sm font-bold select-none"
              >
                PULAR
              </Button>
              <Button
                onTouchStart={() => handleMobileControl("right", true)}
                onTouchEnd={() => handleMobileControl("right", false)}
                onMouseDown={() => handleMobileControl("right", true)}
                onMouseUp={() => handleMobileControl("right", false)}
                className="bg-purple-500 hover:bg-purple-600 text-white w-16 h-16 rounded-none border-4 border-purple-700 active:scale-95 select-none"
              >
                <ArrowRight size={24} />
              </Button>
            </div>
          )}
        </Card>
      </section>

      {/* Level Complete Modal */}
      {showModal && !gameCompleted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="bg-pink-100 border-4 border-pink-500 rounded-none shadow-2xl p-8 max-w-md w-full text-center relative">
            <div className="text-4xl mb-6 animate-bounce">💌</div>
            <h2 className="text-2xl font-bold text-pink-700 mb-6">{modalMessage}</h2>

            <div className="flex flex-col gap-4">
              <Button
                onClick={nextLevel}
                className="bg-pink-500 hover:bg-pink-600 text-white text-xl py-3 rounded-none border-4 border-pink-700 transform hover:scale-105 transition-transform"
              >
                Próximo Nível 🚀
              </Button>
              <Button
                onClick={restartLevel}
                className="bg-purple-500 hover:bg-purple-600 text-white text-xl py-3 rounded-none border-4 border-purple-700 transform hover:scale-105 transition-transform"
              >
                Repetir Nível 🔄
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Final Victory Modal */}
      {showModal && gameCompleted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="bg-pink-100 border-4 border-pink-500 rounded-none shadow-2xl p-8 max-w-md w-full text-center relative">
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-2xl animate-ping"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 1}s`,
                    }}
                  >
                    {["💖", "⭐", "✨", "💕"][Math.floor(Math.random() * 4)]}
                  </div>
                ))}
              </div>
            )}

            <div className="text-6xl mb-6 animate-pulse">💖</div>
            <h2 className="text-2xl font-bold text-pink-700 mb-6">
              Você chegou ao fim da jornada do meu coração — quer namorar comigo?
            </h2>

            <div className="flex flex-col gap-4">
              <Button
                onClick={handleModalResponse}
                className="bg-pink-500 hover:bg-pink-600 text-white text-xl py-3 rounded-none border-4 border-pink-700 transform hover:scale-105 transition-transform"
              >
                Sim 💖
              </Button>
              <Button
                onClick={handleModalResponse}
                className="bg-purple-500 hover:bg-purple-600 text-white text-xl py-3 rounded-none border-4 border-purple-700 transform hover:scale-105 transition-transform"
              >
                Sim 😄
              </Button>
            </div>

            <p className="text-sm text-purple-600 mt-4">(Não há resposta errada aqui! 😉)</p>

            <Button
              onClick={restartGame}
              className="mt-8 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 rounded-none border-2 border-blue-700 transform hover:scale-105 transition-transform"
            >
              Jogar Novamente Desde o Início 🎮
            </Button>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-purple-600 text-white text-center py-8">
        <p className="text-xl font-bold mb-2">Feito com ❤️ pelo seu Jogador 2</p>
        <div className="text-2xl animate-bounce">🎮💕🎮</div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  
        .font-mono {
          font-family: 'Press Start 2P', monospace;
        }
  
        .pixel-text {
          image-rendering: pixelated;
          text-shadow: 2px 2px 0px #000;
        }
  
        .pixel-button {
          image-rendering: pixelated;
        }
  
        .pixel-cloud {
          clip-path: polygon(0 20%, 20% 20%, 20% 0, 40% 0, 40% 20%, 60% 20%, 60% 0, 80% 0, 80% 20%, 100% 20%, 100% 80%, 80% 80%, 80% 100%, 20% 100%, 20% 80%, 0 80%);
        }
  
        @keyframes float {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-15px);
          }
          100% {
            transform: translateY(0);
          }
        }
  
        .floating-heart {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
