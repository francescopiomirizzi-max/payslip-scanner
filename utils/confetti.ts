// --- MOTORE CORIANDOLI (GOD TIER FX) ---
export const triggerConfetti = () => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
    const particleCount = 100;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: any[] = [];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20 - 5,
            life: 100 + Math.random() * 50,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 5 + 2
        });
    }

    const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;

        particles.forEach(p => {
            if (p.life > 0) {
                active = true;
                p.life--;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.4;
                p.vx *= 0.95;

                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        if (active) requestAnimationFrame(render);
        else document.body.removeChild(canvas);
    };

    render();
};
