
import React, { useEffect, useRef } from 'react';

interface FireworksProps {
  active: boolean;
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  decay: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alpha = 1;
    this.color = color;
    this.decay = Math.random() * 0.015 + 0.005;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05; // Gravity
    this.vx *= 0.98; // Air resistance
    this.vy *= 0.98;
    this.alpha -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export const FireworksOverlay: React.FC<FireworksProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const requestRef = useRef<number>(0);

  const launchFirework = (width: number, height: number) => {
    const x = Math.random() * width;
    const y = Math.random() * (height / 2); // Top half
    const colors = ['#ff8866', '#ffcc00', '#ffffff', '#44aaff', '#ff4444'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    for (let i = 0; i < 40; i++) {
      particles.current.push(new Particle(x, y, color));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const animate = () => {
      if (!ctx || !canvas) return;

      // Clear with trail effect
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.globalCompositeOperation = 'lighter';

      // Update particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.update();
        p.draw(ctx);
        if (p.alpha <= 0) {
          particles.current.splice(i, 1);
        }
      }

      // Randomly launch fireworks if active
      if (active && Math.random() < 0.03) {
        launchFirework(canvas.width, canvas.height);
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-50 mix-blend-screen"
    />
  );
};
