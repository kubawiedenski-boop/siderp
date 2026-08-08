// premium.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. Preloader
    const preloader = document.getElementById('preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.style.opacity = '0';
            setTimeout(() => { preloader.style.display = 'none'; }, 500);
        }, 800); // 800ms loading sequence
    }

    // 2. Custom Cursor
    const cursorDot = document.getElementById('cursor-dot');
    const cursorOutline = document.getElementById('cursor-outline');
    if (cursorDot && cursorOutline && window.innerWidth > 768) {
        window.addEventListener('mousemove', (e) => {
            const posX = e.clientX;
            const posY = e.clientY;

            cursorDot.style.left = `${posX}px`;
            cursorDot.style.top = `${posY}px`;

            cursorOutline.animate({
                left: `${posX}px`,
                top: `${posY}px`
            }, { duration: 50, fill: "forwards" });
        });

        const hoverElements = document.querySelectorAll('a, button, input, select, .stat-card, .faction-card, .btn');
        hoverElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursorOutline.style.transform = 'translate(-50%, -50%) scale(1.5)';
                cursorOutline.style.backgroundColor = 'rgba(93, 193, 249, 0.1)';
            });
            el.addEventListener('mouseleave', () => {
                cursorOutline.style.transform = 'translate(-50%, -50%) scale(1)';
                cursorOutline.style.backgroundColor = 'transparent';
            });
        });
    }

    // 3. 3D Tilt Effect
    const tiltElements = document.querySelectorAll('.tilt-effect');
    if (window.innerWidth > 768) {
        tiltElements.forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const xOffset = (x - rect.width / 2) / (rect.width / 2);
                const yOffset = (y - rect.height / 2) / (rect.height / 2);

                const multiplier = 8; // degrees
                el.style.transform = `perspective(1000px) rotateX(${yOffset * multiplier}deg) rotateY(${-xOffset * multiplier}deg) scale3d(1.02, 1.02, 1.02)`;
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            });
        });
    }

    // 4. Smooth Page Transitions
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('href');
            if (target && !target.startsWith('#') && !target.startsWith('javascript') && !link.hasAttribute('target') && !target.includes('http')) {
                e.preventDefault();
                document.body.classList.add('fade-out');
                setTimeout(() => {
                    window.location.href = target;
                }, 350); 
            }
        });
    });

    // 5. Magnetic Buttons
    const magneticElements = document.querySelectorAll('.btn, .footer-social, .nav-links a, .filter-btn');
    if (window.innerWidth > 768) {
        magneticElements.forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                el.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = `translate(0px, 0px)`;
            });
            el.classList.add('magnetic');
        });
    }

    // 6. Global Parallax Background
    const heroBg = document.querySelector('.hero-overlay') || document.querySelector('.page-header');
    if (heroBg && window.innerWidth > 768) {
        window.addEventListener('mousemove', (e) => {
            const x = (window.innerWidth - e.pageX * 2) / 90;
            const y = (window.innerHeight - e.pageY * 2) / 90;
            heroBg.style.transform = `translateX(${x}px) translateY(${y}px)`;
        });
    }
});
