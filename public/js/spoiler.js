class TelegramSpoiler {
    constructor(target, options = {}) {
        this.target = target;
        this.options = Object.assign({
            density: 0.08,      // Particles per pixel
            speed: 0.6,         // Particle drift speed
            maxSize: 5,       // Max particle size in px
            fps: 30,            // Animation FPS limit
            instant: false      // Should appear instantly on init
        }, options);

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.isRevealed = true;
        this.isAnimating = false;
        this.animationFrame = null;
        this.lastDraw = 0;
        this.frameInterval = 1000 / this.options.fps;
        
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.init();
    }

    init() {
        const isVoid = /^(?:input|img|br|hr)$/i.test(this.target.tagName);

        if (isVoid) {
            this.container = this.target.parentElement;
            const parentStyle = getComputedStyle(this.container);
            if (parentStyle.position === 'static') {
                this.container.style.position = 'relative';
            }
        } else {
            this.container = this.target;
            const style = getComputedStyle(this.target);
            if (style.position === 'static') {
                this.target.style.position = 'relative';
            }
        }

        this.canvas.className = 'spoiler-canvas';
        this.canvas.style.position = 'absolute';
        
        if (!isVoid) {
            this.canvas.style.inset = '0';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
        }
        
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '10';
        this.canvas.style.transition = 'opacity 0.3s ease';
        this.canvas.style.opacity = '0';

        const style = getComputedStyle(this.target);
        this.canvas.style.borderRadius = style.borderRadius || '4px';
        
        this.container.appendChild(this.canvas);

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.target);

        this.hide(this.options.instant);
    }

    resize() {
        const rect = this.target.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.width = rect.width;
        this.height = rect.height;
        
        if (this.width === 0 || this.height === 0) return;

        this.textWidth = this.width;
        if (this.target.tagName === 'INPUT' || this.target.tagName === 'TEXTAREA') {
             const style = getComputedStyle(this.target);
             const text = this.target.value || this.target.getAttribute('placeholder') || "";
             
             if (!this.measureCtx) {
                 const c = document.createElement('canvas');
                 this.measureCtx = c.getContext('2d');
             }
             this.measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
             const metrics = this.measureCtx.measureText(text);
             const paddingLeft = parseFloat(style.paddingLeft) || 0;
             this.textWidth = Math.min(metrics.width + paddingLeft + 10, this.width);
        }

        if (this.container !== this.target) {
            this.canvas.style.left = this.target.offsetLeft + 'px';
            this.canvas.style.top = this.target.offsetTop + 'px';
            this.canvas.style.width = this.target.offsetWidth + 'px';
            this.canvas.style.height = this.target.offsetHeight + 'px';
            
            const style = getComputedStyle(this.target);
            this.canvas.style.borderRadius = style.borderRadius;
        }

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        
        if (!this.isRevealed) {
            this.spawnParticles();
        }
    }

    spawnParticles() {
        const width = this.textWidth || this.width;
        const area = width * this.height;
        const count = Math.floor(area * this.options.density);
        const computedColor = '#c9c9c9';
        
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle(computedColor));
        }
    }

    createParticle(color) {
        const width = this.textWidth || this.width;
        return {
            x: Math.random() * width,
            y: Math.random() * this.height,
            vx: (Math.random() - 0.5) * this.options.speed,
            vy: (Math.random() - 0.5) * this.options.speed,
            size: Math.random() * this.options.maxSize + 0.5,
            alpha: Math.random() * 0.4 + 0.5,
            color: color,
            shape: Math.random() > 0.6 ? 'rect' : 'circle'
        };
    }

    draw(timestamp) {
        if (!this.isAnimating) return;

        if (timestamp - this.lastDraw < this.frameInterval) {
            this.animationFrame = requestAnimationFrame(this.draw.bind(this));
            return;
        }
        this.lastDraw = timestamp;

        this.ctx.clearRect(0, 0, this.width, this.height);

        let activeParticles = 0;

        for (const p of this.particles) {
            if (p.alpha <= 0.01) continue;
            activeParticles++;

            if (!this.reducedMotion && !this.isRevealed) {
                p.x += p.vx;
                p.y += p.vy;
                
                const width = this.textWidth || this.width;
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = this.height;
                if (p.y > this.height) p.y = 0;
            } else if (this.isRevealed) {
                // Disperse animation (optional now since we fade opacity, but keeps it looking nice)
                p.alpha *= 0.92;
                p.x += p.vx * 1.5;
                p.y += p.vy * 1.5;
            }

            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            
            this.ctx.beginPath();
            if (p.shape === 'circle') {
                this.ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            } else {
                this.ctx.rect(p.x, p.y, p.size, p.size * 0.6);
            }
            this.ctx.fill();
        }

        if (this.isRevealed && activeParticles === 0) {
            this.isAnimating = false;
            // Canvas display none is handled in reveal() timeout
            return;
        }

        this.animationFrame = requestAnimationFrame(this.draw.bind(this));
    }

    reveal() {
        if (this.isRevealed) return;
        this.isRevealed = true;
        
        this.target.style.color = '';
        this.target.style.cursor = 'text';
        this.target.style.userSelect = 'text';
        this.target.style.pointerEvents = '';
        this.target.style.visibility = '';
        
        // Плавное исчезновение через opacity
        this.canvas.style.opacity = '0';
        
        // Ждем окончания CSS перехода перед скрытием
        setTimeout(() => {
            if (this.isRevealed) {
                this.canvas.style.display = 'none';
                this.isAnimating = false;
            }
        }, 300);
    }

    hide(instant = false) {
        if (!this.isRevealed && !instant) return;
        this.isRevealed = false;
        
        this.canvas.style.display = 'block';
        this.canvas.style.visibility = 'visible';
        // Force reflow
        void this.canvas.offsetWidth;
        
        // Плавное появление
        if (instant) {
            this.canvas.style.opacity = '1';
        } else {
            requestAnimationFrame(() => {
                this.canvas.style.opacity = '1';
            });
        }

        this.target.style.color = 'transparent';
        this.target.style.cursor = 'default';
        this.target.style.userSelect = 'none';
        this.target.style.pointerEvents = 'none';
        this.target.style.visibility = 'hidden';
        
        this.resize();
        
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.draw(0);
        }
    }

    toggle() {
        if (this.isRevealed) {
            this.hide();
        } else {
            this.reveal();
        }
    }

    destroy() {
        this.isAnimating = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.target) {
            // this.target.removeEventListener('click', this.onClick); // Removed
            this.target.style.color = '';
            this.target.style.position = '';
            this.target.style.cursor = '';
            this.target.style.userSelect = '';
            this.target.style.pointerEvents = '';
            this.target.style.visibility = '';
            if (this.canvas && this.canvas.parentNode === this.container) {
                this.container.removeChild(this.canvas);
            }
        }
    }
}