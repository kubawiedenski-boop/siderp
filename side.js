let currentUser = null;

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function injectCitizenProfileCSS() {
    if (document.getElementById('siderp-citizen-profile-css')) return;

    const style = document.createElement('style');
    style.id = 'siderp-citizen-profile-css';

    style.textContent = `
        /* =========================================================
           SIDErp — PREMIUM PROFIL OBYWATELA
           ========================================================= */

        #player-modal {
            padding: 24px !important;
            background:
                radial-gradient(circle at 50% 0%, rgba(93,193,249,.07), transparent 42%),
                rgba(0,0,0,.82) !important;
            backdrop-filter: blur(18px);
        }

        #player-modal .modal-container {
            width: min(1120px, 96vw) !important;
            max-width: 1120px !important;
            max-height: 92vh !important;
            overflow: hidden !important;
            padding: 0 !important;
            border-radius: 26px !important;
            border: 1px solid rgba(255,255,255,.075) !important;
            background:
                radial-gradient(circle at 85% 0%, rgba(93,193,249,.08), transparent 30%),
                linear-gradient(145deg, #090c0e 0%, #060708 55%, #080a0b 100%) !important;
            box-shadow:
                0 40px 120px rgba(0,0,0,.72),
                0 0 0 1px rgba(255,255,255,.025) inset,
                0 0 80px rgba(93,193,249,.045) !important;
        }

        #player-modal .modal-header {
            height: 72px;
            padding: 0 28px !important;
            display: flex;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,.055);
            background: rgba(255,255,255,.012);
        }

        #player-modal .modal-header h2 {
            margin: 0 !important;
            color: #fff !important;
            font-size: 1rem !important;
            font-weight: 800 !important;
            letter-spacing: -.2px;
        }

        #player-modal .modal-header h2 i {
            color: var(--gold, #5dc1f9);
            margin-right: 10px;
        }

        #player-modal .btn-close {
            width: 38px !important;
            height: 38px !important;
            border-radius: 11px !important;
            color: #6d7478 !important;
            background: rgba(255,255,255,.025) !important;
            border: 1px solid rgba(255,255,255,.055) !important;
            transition: .22s ease !important;
        }

        #player-modal .btn-close:hover {
            color: #fff !important;
            border-color: rgba(93,193,249,.28) !important;
            background: rgba(93,193,249,.07) !important;
            transform: rotate(4deg);
        }

        #player-modal .modal-body {
            padding: 0 !important;
            overflow-y: auto !important;
            max-height: calc(92vh - 72px);
        }

        .citizen-profile {
            padding: 26px;
        }

        /* HERO */

        .citizen-hero {
            position: relative;
            min-height: 172px;
            display: flex;
            align-items: flex-end;
            padding: 26px;
            overflow: hidden;
            border-radius: 21px;
            border: 1px solid rgba(255,255,255,.065);
            background:
                radial-gradient(circle at 82% 30%, rgba(93,193,249,.18), transparent 26%),
                radial-gradient(circle at 65% 100%, rgba(93,193,249,.07), transparent 30%),
                linear-gradient(110deg, #0b1012 0%, #0a0d0f 45%, #101619 100%);
            box-shadow:
                inset 0 1px rgba(255,255,255,.025),
                0 20px 60px rgba(0,0,0,.28);
        }

        .citizen-hero::before {
            content: '';
            position: absolute;
            width: 360px;
            height: 360px;
            right: -120px;
            top: -170px;
            border-radius: 50%;
            background: rgba(93,193,249,.10);
            filter: blur(65px);
            pointer-events: none;
        }

        .citizen-hero::after {
            content: 'SideRP';
            position: absolute;
            right: 42px;
            bottom: 22px;
            color: rgba(255,255,255,.035);
            font-size: 5rem;
            font-weight: 900;
            letter-spacing: -5px;
            pointer-events: none;
        }

        .citizen-accent {
            position: absolute;
            left: 0;
            top: 18px;
            bottom: 18px;
            width: 3px;
            border-radius: 0 5px 5px 0;
            background: var(--gold, #5dc1f9);
            box-shadow: 0 0 24px rgba(93,193,249,.65);
        }

        .citizen-hero-inner {
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            gap: 20px;
            width: 100%;
        }

        .citizen-avatar-wrap {
            position: relative;
            flex: 0 0 auto;
        }

        .citizen-avatar {
            width: 104px;
            height: 104px;
            display: block;
            object-fit: cover;
            border-radius: 25px;
            border: 2px solid rgba(255,255,255,.12);
            box-shadow:
                0 15px 40px rgba(0,0,0,.45),
                0 0 0 5px rgba(93,193,249,.035);
        }

        .citizen-online {
            position: absolute;
            right: -3px;
            bottom: 3px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #39e85b;
            border: 4px solid #090c0e;
            box-shadow: 0 0 15px rgba(57,232,91,.65);
        }

        .citizen-name {
            margin: 0;
            color: #fff;
            font-size: clamp(1.55rem, 3vw, 2.15rem);
            line-height: 1;
            font-weight: 900;
            letter-spacing: -1px;
        }

        .citizen-name .verified {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 23px;
            height: 23px;
            margin-left: 8px;
            vertical-align: 4px;
            border-radius: 50%;
            color: #071006;
            background: #43ef54;
            font-size: .68rem;
            box-shadow: 0 0 18px rgba(67,239,84,.25);
        }

        .citizen-discord {
            margin-top: 9px;
            color: #90999d;
            font-size: .82rem;
        }

        .citizen-discord i {
            color: #aeb6ba;
            margin-right: 5px;
        }

        .citizen-status {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            margin-top: 13px;
            padding: 6px 10px;
            border-radius: 999px;
            color: #68f36d;
            background: rgba(57,232,91,.055);
            border: 1px solid rgba(57,232,91,.13);
            font-size: .59rem;
            font-weight: 900;
            letter-spacing: 1px;
        }

        .citizen-status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #43ef54;
            box-shadow: 0 0 9px #43ef54;
        }

        /* GRID */

        .citizen-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 315px;
            gap: 18px;
            margin-top: 18px;
        }

        .citizen-main {
            min-width: 0;
        }

        .citizen-side {
            min-width: 0;
        }

        /* STATS */

        .citizen-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            overflow: hidden;
            border-radius: 19px;
            border: 1px solid rgba(255,255,255,.055);
            background: rgba(255,255,255,.018);
        }

        .citizen-stat {
            position: relative;
            min-height: 92px;
            padding: 18px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-right: 1px solid rgba(255,255,255,.045);
            transition: .22s ease;
        }

        .citizen-stat:last-child {
            border-right: 0;
        }

        .citizen-stat:hover {
            background: rgba(255,255,255,.025);
        }

        .citizen-stat-icon {
            width: 39px;
            height: 39px;
            flex: 0 0 39px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            color: var(--gold, #5dc1f9);
            background: rgba(93,193,249,.075);
            border: 1px solid rgba(93,193,249,.10);
        }

        .citizen-stat-label {
            display: block;
            color: #747d81;
            font-size: .59rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .75px;
        }

        .citizen-stat-value {
            display: block;
            margin-top: 4px;
            color: #fff;
            font-size: 1.3rem;
            line-height: 1;
            font-weight: 900;
        }

        /* SECTION */

        .citizen-section {
            margin-top: 18px;
            padding: 21px;
            border-radius: 19px;
            border: 1px solid rgba(255,255,255,.055);
            background: rgba(255,255,255,.014);
        }

        .citizen-section-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 15px;
        }

        .citizen-section-title h3 {
            margin: 0;
            color: #f5f7f7;
            font-size: .92rem;
            font-weight: 850;
        }

        .citizen-section-title h3 i {
            color: var(--gold, #5dc1f9);
            margin-right: 8px;
        }

        .citizen-link {
            color: var(--gold, #5dc1f9);
            font-size: .68rem;
            font-weight: 800;
            text-decoration: none;
            transition: .2s ease;
        }

        .citizen-link:hover {
            color: #fff;
        }

        /* LAST APPLICATION */

        .citizen-last {
            min-height: 82px;
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 16px;
            border-radius: 15px;
            border: 1px solid rgba(255,255,255,.045);
            background: linear-gradient(100deg, rgba(93,193,249,.055), rgba(255,255,255,.012));
        }

        .citizen-last-icon {
            width: 44px;
            height: 44px;
            flex: 0 0 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 13px;
            color: var(--gold, #5dc1f9);
            background: rgba(93,193,249,.08);
            border: 1px solid rgba(93,193,249,.12);
            font-size: 1rem;
        }

        .citizen-last-info {
            min-width: 0;
            flex: 1;
        }

        .citizen-last-info strong {
            display: block;
            color: #fff;
            font-size: .82rem;
        }

        .citizen-last-info span {
            display: block;
            margin-top: 3px;
            color: #687175;
            font-size: .69rem;
        }

        .citizen-pill {
            padding: 7px 10px;
            border-radius: 999px;
            color: #7a8387;
            background: rgba(255,255,255,.035);
            border: 1px solid rgba(255,255,255,.055);
            font-size: .58rem;
            font-weight: 900;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .citizen-pill.accepted {
            color: #5cf06c;
            background: rgba(57,232,91,.06);
            border-color: rgba(57,232,91,.12);
        }

        .citizen-pill.pending {
            color: #ffc84f;
            background: rgba(255,193,7,.055);
            border-color: rgba(255,193,7,.11);
        }

        .citizen-pill.rejected {
            color: #ff6969;
            background: rgba(239,68,68,.055);
            border-color: rgba(239,68,68,.11);
        }

        /* ACTIVITY */

        .citizen-activity {
            overflow: hidden;
            border: 1px solid rgba(255,255,255,.045);
            border-radius: 15px;
        }

        .citizen-activity-row {
            min-height: 55px;
            padding: 0 15px;
            display: grid;
            grid-template-columns: 34px 1fr auto;
            align-items: center;
            gap: 10px;
            border-bottom: 1px solid rgba(255,255,255,.045);
        }

        .citizen-activity-row:last-child {
            border-bottom: 0;
        }

        .citizen-activity-icon {
            width: 29px;
            height: 29px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            color: var(--gold, #5dc1f9);
            background: rgba(93,193,249,.055);
            font-size: .7rem;
        }

        .citizen-activity-label {
            color: #858e92;
            font-size: .72rem;
        }

        .citizen-activity-value {
            color: #dfe4e5;
            font-size: .72rem;
            font-weight: 700;
            text-align: right;
        }

        /* SIDE STATUS */

        .citizen-side-card {
            padding: 21px;
            border-radius: 19px;
            border: 1px solid rgba(255,255,255,.055);
            background:
                radial-gradient(circle at 100% 0%, rgba(93,193,249,.08), transparent 45%),
                rgba(255,255,255,.014);
        }

        .citizen-side-title {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #f3f5f5;
            font-size: .9rem;
            font-weight: 850;
            margin-bottom: 16px;
        }

        .citizen-side-title i {
            color: var(--gold, #5dc1f9);
        }

        .citizen-status-list {
            display: grid;
            gap: 9px;
        }

        .citizen-status-row {
            min-height: 67px;
            padding: 11px 13px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-radius: 14px;
            background: rgba(255,255,255,.022);
            border: 1px solid rgba(255,255,255,.045);
        }

        .citizen-status-icon {
            width: 36px;
            height: 36px;
            flex: 0 0 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-size: .8rem;
        }

        .citizen-status-row.accepted .citizen-status-icon {
            color: #4bef5e;
            background: rgba(57,232,91,.09);
        }

        .citizen-status-row.pending .citizen-status-icon {
            color: #ffc928;
            background: rgba(255,193,7,.09);
        }

        .citizen-status-row.rejected .citizen-status-icon {
            color: #ff5959;
            background: rgba(239,68,68,.09);
        }

        .citizen-status-row strong {
            color: #fff;
            font-size: 1.12rem;
            font-weight: 900;
        }

        .citizen-status-row span {
            margin-left: auto;
            color: #70797d;
            font-size: .59rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .65px;
        }

        /* COMMUNITY */

        .citizen-community {
            position: relative;
            overflow: hidden;
            margin-top: 18px;
            padding: 25px 20px;
            text-align: center;
            border-radius: 19px;
            border: 1px solid rgba(93,193,249,.10);
            background:
                radial-gradient(circle at 50% 0%, rgba(93,193,249,.12), transparent 50%),
                linear-gradient(145deg, rgba(93,193,249,.045), rgba(255,255,255,.012));
        }

        .citizen-community::before {
            content: '';
            position: absolute;
            width: 130px;
            height: 130px;
            left: 50%;
            top: -90px;
            transform: translateX(-50%);
            background: rgba(93,193,249,.16);
            filter: blur(45px);
        }

        .citizen-community-icon {
            position: relative;
            z-index: 1;
            width: 54px;
            height: 54px;
            margin: 0 auto 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 17px;
            color: var(--gold, #5dc1f9);
            background: rgba(93,193,249,.075);
            border: 1px solid rgba(93,193,249,.13);
            box-shadow: 0 0 30px rgba(93,193,249,.08);
            font-size: 1.25rem;
        }

        .citizen-community h3 {
            position: relative;
            z-index: 1;
            margin: 0;
            color: #fff;
            font-size: 1rem;
            font-weight: 900;
        }

        .citizen-community p {
            position: relative;
            z-index: 1;
            margin: 7px auto 17px;
            max-width: 230px;
            color: #70797d;
            font-size: .7rem;
            line-height: 1.55;
        }

        .citizen-discord-btn {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            min-height: 43px;
            border-radius: 12px;
            color: #061006;
            background: var(--gold, #5dc1f9);
            text-decoration: none;
            font-size: .68rem;
            font-weight: 900;
            transition: .22s ease;
            box-shadow: 0 8px 28px rgba(93,193,249,.16);
        }

        .citizen-discord-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 34px rgba(93,193,249,.25);
            filter: brightness(1.07);
        }

        /* LOADING */

        .citizen-loading {
            min-height: 480px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 13px;
            color: #555;
        }

        .citizen-loading i {
            color: var(--gold, #5dc1f9);
            font-size: 1.5rem;
        }

        .citizen-loading span {
            font-size: .7rem;
        }

        .citizen-error {
            padding: 55px 25px;
            text-align: center;
            color: #777;
        }

        .citizen-error i {
            display: block;
            margin-bottom: 12px;
            color: #e55;
            font-size: 1.8rem;
        }

        /* MOBILE */

        @media (max-width: 850px) {
            #player-modal {
                padding: 10px !important;
            }

            #player-modal .modal-container {
                width: 100% !important;
                max-height: 96vh !important;
                border-radius: 19px !important;
            }

            .citizen-profile {
                padding: 13px;
            }

            .citizen-grid {
                grid-template-columns: 1fr;
            }

            .citizen-stats {
                grid-template-columns: repeat(2, 1fr);
            }

            .citizen-stat:nth-child(2) {
                border-right: 0;
            }

            .citizen-stat:nth-child(-n+2) {
                border-bottom: 1px solid rgba(255,255,255,.045);
            }
        }

        @media (max-width: 560px) {
            #player-modal .modal-header {
                padding: 0 16px !important;
            }

            .citizen-hero {
                min-height: auto;
                padding: 19px;
            }

            .citizen-hero-inner {
                align-items: flex-start;
                flex-direction: column;
            }

            .citizen-avatar {
                width: 82px;
                height: 82px;
                border-radius: 20px;
            }

            .citizen-name {
                font-size: 1.55rem;
            }

            .citizen-hero::after {
                display: none;
            }

            .citizen-stats {
                grid-template-columns: 1fr 1fr;
            }

            .citizen-stat {
                min-height: 76px;
                padding: 13px;
            }

            .citizen-stat-icon {
                width: 34px;
                height: 34px;
                flex-basis: 34px;
            }

            .citizen-stat-label {
                font-size: .53rem;
            }

            .citizen-last {
                align-items: flex-start;
            }

            .citizen-pill {
                margin-left: auto;
            }
        }
    `;

    document.head.appendChild(style);
}

async function checkLogin() {
    try {
        const res = await fetch('/api/me', {
            credentials: 'same-origin'
        }).then(r => r.json());

        const navLogin = document.getElementById('nav-login');
        const navPanel = document.getElementById('nav-panel');
        const navLogout = document.getElementById('nav-logout');

        if (res.loggedIn && res.user) {
            currentUser = res;

            if (navLogin) navLogin.style.display = 'none';
            if (navPanel) navPanel.style.display = 'block';
            if (navLogout) navLogout.style.display = 'block';

            const userDash = document.getElementById('user-dashboard');

            if (userDash) {
                userDash.style.display = 'flex';

                const name = document.getElementById('user-name');
                const avatar = document.getElementById('user-avatar');

                if (name) {
                    name.textContent =
                        res.user.globalName ||
                        res.user.username ||
                        'Użytkownik';
                }

                if (avatar) {
                    avatar.src =
                        res.user.avatar ||
                        'https://cdn.discordapp.com/embed/avatars/0.png';
                }

                const appsList = document.getElementById('my-apps');

                if (appsList) {
                    appsList.style.display = 'block';
                }

                if (typeof loadMyApps === 'function') {
                    loadMyApps();
                }
            }
        } else {
            if (navLogin) navLogin.style.display = 'block';
            if (navPanel) navPanel.style.display = 'none';
            if (navLogout) navLogout.style.display = 'none';
        }
    } catch (err) {
        console.error('SideRP login error:', err);
    }
}

function statusInfo(status) {
    if (status === 'accepted') {
        return {
            text: 'Przyjęte',
            className: 'accepted',
            icon: 'fa-circle-check'
        };
    }

    if (status === 'rejected') {
        return {
            text: 'Odrzucone',
            className: 'rejected',
            icon: 'fa-circle-xmark'
        };
    }

    return {
        text: 'Oczekujące',
        className: 'pending',
        icon: 'fa-clock'
    };
}

function formatDate(date) {
    if (!date) return '—';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return '—';
    }

    return parsed.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

async function openPlayerPanel() {
    injectCitizenProfileCSS();

    const modal = document.getElementById('player-modal');
    const content = document.getElementById('player-modal-content');

    if (!modal || !content) return;

    modal.style.display = 'flex';

    content.innerHTML = `
        <div class="citizen-loading">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <span>Ładowanie profilu obywatela...</span>
        </div>
    `;

    try {
        /*
         * Zero FiveM API.
         * Korzystamy wyłącznie z istniejącego Discord/OAuth
         * oraz lokalnych endpointów SideRP.
         */
        const [meResponse, playerResponse, appsResponse] =
            await Promise.all([
                fetch('/api/me', {
                    credentials: 'same-origin'
                }),

                fetch('/api/player/data', {
                    credentials: 'same-origin'
                }),

                fetch('/api/my-applications', {
                    credentials: 'same-origin'
                })
            ]);

        const me = await meResponse.json();
        const player = await playerResponse.json();

        let applications = [];

        if (appsResponse.ok) {
            const appsData = await appsResponse.json();

            if (Array.isArray(appsData)) {
                applications = appsData;
            } else if (Array.isArray(appsData.applications)) {
                applications = appsData.applications;
            }
        }

        if (!player.success) {
            throw new Error(
                player.error ||
                'Nie udało się pobrać danych profilu.'
            );
        }

        const user =
            me.user ||
            currentUser?.user ||
            {};

        const displayName =
            user.globalName ||
            user.username ||
            'Użytkownik';

        const username =
            user.username ||
            displayName;

        const avatar =
            user.avatar ||
            'https://cdn.discordapp.com/embed/avatars/0.png';

        const accepted =
            Number(player.stats?.accepted || 0);

        const pending =
            Number(player.stats?.pending || 0);

        const rejected =
            Number(player.stats?.rejected || 0);

        const total =
            accepted +
            pending +
            rejected;

        const sortedApps = [...applications].sort(
            (a, b) =>
                new Date(b.createdAt || 0) -
                new Date(a.createdAt || 0)
        );

        const latest = sortedApps[0] || null;

        const latestStatus =
            latest
                ? statusInfo(latest.status)
                : null;

        const latestFaction =
            latest?.faction ||
            'Brak podań';

        const discordTag =
            user.discriminator &&
            user.discriminator !== '0'
                ? `${username}#${user.discriminator}`
                : username;

        content.innerHTML = `
            <div class="citizen-profile">

                <!-- HERO -->

                <section class="citizen-hero">
                    <div class="citizen-accent"></div>

                    <div class="citizen-hero-inner">

                        <div class="citizen-avatar-wrap">
                            <img
                                class="citizen-avatar"
                                src="${escapeHTML(avatar)}"
                                alt="Avatar użytkownika"
                            >

                            <span class="citizen-online"></span>
                        </div>

                        <div>
                            <h1 class="citizen-name">
                                ${escapeHTML(displayName)}

                                <span
                                    class="verified"
                                    title="Zweryfikowany Discord"
                                >
                                    <i class="fa-solid fa-check"></i>
                                </span>
                            </h1>

                            <div class="citizen-discord">
                                <i class="fa-brands fa-discord"></i>
                                ${escapeHTML(discordTag)}
                            </div>

                            <div class="citizen-status">
                                <span class="citizen-status-dot"></span>
                                ZALOGOWANY
                            </div>
                        </div>

                    </div>
                </section>


                <div class="citizen-grid">

                    <main class="citizen-main">

                        <!-- STATYSTYKI -->

                        <section class="citizen-stats">

                            <div class="citizen-stat">
                                <div class="citizen-stat-icon">
                                    <i class="fa-solid fa-file-lines"></i>
                                </div>

                                <div>
                                    <span class="citizen-stat-label">
                                        Wszystkie podania
                                    </span>

                                    <strong class="citizen-stat-value">
                                        ${total}
                                    </strong>
                                </div>
                            </div>


                            <div class="citizen-stat">
                                <div class="citizen-stat-icon">
                                    <i class="fa-solid fa-circle-check"></i>
                                </div>

                                <div>
                                    <span class="citizen-stat-label">
                                        Przyjęte
                                    </span>

                                    <strong class="citizen-stat-value">
                                        ${accepted}
                                    </strong>
                                </div>
                            </div>


                            <div class="citizen-stat">
                                <div class="citizen-stat-icon">
                                    <i class="fa-solid fa-clock"></i>
                                </div>

                                <div>
                                    <span class="citizen-stat-label">
                                        Oczekujące
                                    </span>

                                    <strong class="citizen-stat-value">
                                        ${pending}
                                    </strong>
                                </div>
                            </div>


                            <div class="citizen-stat">
                                <div class="citizen-stat-icon">
                                    <i class="fa-solid fa-circle-xmark"></i>
                                </div>

                                <div>
                                    <span class="citizen-stat-label">
                                        Odrzucone
                                    </span>

                                    <strong class="citizen-stat-value">
                                        ${rejected}
                                    </strong>
                                </div>
                            </div>

                        </section>


                        <!-- OSTATNIE PODANIE -->

                        <section class="citizen-section">

                            <div class="citizen-section-title">
                                <h3>
                                    <i class="fa-solid fa-clipboard-list"></i>
                                    Ostatnie podanie
                                </h3>

                                ${
                                    total > 0
                                        ? `
                                            <a
                                                class="citizen-link"
                                                href="podania.html"
                                            >
                                                Zobacz wszystkie
                                                <i class="fa-solid fa-arrow-right"></i>
                                            </a>
                                        `
                                        : ''
                                }
                            </div>

                            ${
                                latest
                                    ? `
                                        <div class="citizen-last">

                                            <div class="citizen-last-icon">
                                                <i class="fa-solid fa-file-signature"></i>
                                            </div>

                                            <div class="citizen-last-info">
                                                <strong>
                                                    ${escapeHTML(latestFaction)}
                                                </strong>

                                                <span>
                                                    Złożono
                                                    ${formatDate(latest.createdAt)}
                                                </span>
                                            </div>

                                            <span class="citizen-pill ${latestStatus.className}">
                                                ${latestStatus.text}
                                            </span>

                                        </div>
                                    `
                                    : `
                                        <div class="citizen-last">

                                            <div class="citizen-last-icon">
                                                <i class="fa-solid fa-file-circle-plus"></i>
                                            </div>

                                            <div class="citizen-last-info">
                                                <strong>
                                                    Brak podań
                                                </strong>

                                                <span>
                                                    Nie złożyłeś jeszcze żadnego podania.
                                                </span>
                                            </div>

                                        </div>
                                    `
                            }

                        </section>


                        <!-- AKTYWNOŚĆ -->

                        <section class="citizen-section">

                            <div class="citizen-section-title">
                                <h3>
                                    <i class="fa-solid fa-chart-line"></i>
                                    Twoja aktywność
                                </h3>
                            </div>

                            <div class="citizen-activity">

                                <div class="citizen-activity-row">

                                    <div class="citizen-activity-icon">
                                        <i class="fa-solid fa-user"></i>
                                    </div>

                                    <span class="citizen-activity-label">
                                        Konto Discord
                                    </span>

                                    <strong class="citizen-activity-value">
                                        ${escapeHTML(username)}
                                    </strong>

                                </div>


                                <div class="citizen-activity-row">

                                    <div class="citizen-activity-icon">
                                        <i class="fa-solid fa-fingerprint"></i>
                                    </div>

                                    <span class="citizen-activity-label">
                                        Discord ID
                                    </span>

                                    <strong class="citizen-activity-value">
                                        ${escapeHTML(user.id || '—')}
                                    </strong>

                                </div>


                                <div class="citizen-activity-row">

                                    <div class="citizen-activity-icon">
                                        <i class="fa-solid fa-file-lines"></i>
                                    </div>

                                    <span class="citizen-activity-label">
                                        Łączna liczba podań
                                    </span>

                                    <strong class="citizen-activity-value">
                                        ${total}
                                    </strong>

                                </div>


                                <div class="citizen-activity-row">

                                    <div class="citizen-activity-icon">
                                        <i class="fa-solid fa-shield-halved"></i>
                                    </div>

                                    <span class="citizen-activity-label">
                                        Status konta
                                    </span>

                                    <strong class="citizen-activity-value">
                                        Aktywne
                                    </strong>

                                </div>

                            </div>

                        </section>

                    </main>


                    <!-- PRAWA KOLUMNA -->

                    <aside class="citizen-side">

                        <section class="citizen-side-card">

                            <div class="citizen-side-title">
                                <i class="fa-solid fa-shield-halved"></i>
                                Status podań
                            </div>


                            <div class="citizen-status-list">

                                <div class="citizen-status-row accepted">

                                    <div class="citizen-status-icon">
                                        <i class="fa-solid fa-check"></i>
                                    </div>

                                    <strong>
                                        ${accepted}
                                    </strong>

                                    <span>
                                        Przyjęte
                                    </span>

                                </div>


                                <div class="citizen-status-row pending">

                                    <div class="citizen-status-icon">
                                        <i class="fa-solid fa-clock"></i>
                                    </div>

                                    <strong>
                                        ${pending}
                                    </strong>

                                    <span>
                                        Oczekujące
                                    </span>

                                </div>


                                <div class="citizen-status-row rejected">

                                    <div class="citizen-status-icon">
                                        <i class="fa-solid fa-xmark"></i>
                                    </div>

                                    <strong>
                                        ${rejected}
                                    </strong>

                                    <span>
                                        Odrzucone
                                    </span>

                                </div>

                            </div>

                        </section>


                        <section class="citizen-community">

                            <div class="citizen-community-icon">
                                <i class="fa-solid fa-crown"></i>
                            </div>

                            <h3>
                                Dołącz do społeczności
                            </h3>

                            <p>
                                Rozwijaj swoją postać, zdobywaj
                                rangę i twórz z nami swoją historię.
                            </p>

                            <a
                                href="https://discord.gg/Sideroleplay"
                                target="_blank"
                                rel="noopener"
                                class="citizen-discord-btn"
                            >
                                <i class="fa-brands fa-discord"></i>
                                Dołącz na Discord
                                <i class="fa-solid fa-arrow-right"></i>
                            </a>

                        </section>

                    </aside>

                </div>

            </div>
        `;

    } catch (err) {
        console.error('Citizen profile error:', err);

        content.innerHTML = `
            <div class="citizen-error">
                <i class="fa-solid fa-triangle-exclamation"></i>

                <strong>
                    Nie udało się załadować profilu
                </strong>

                <p>
                    ${escapeHTML(err.message)}
                </p>
            </div>
        `;
    }
}

function closePlayerPanel() {
    const modal = document.getElementById('player-modal');

    if (modal) {
        modal.style.display = 'none';
    }
}


/* Kliknięcie w tło zamyka profil */
document.addEventListener('click', function (event) {
    const modal = document.getElementById('player-modal');

    if (
        modal &&
        event.target === modal
    ) {
        closePlayerPanel();
    }
});


/* ESC zamyka profil */
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closePlayerPanel();
    }
});


injectCitizenProfileCSS();

checkLogin();

document.addEventListener(
    'DOMContentLoaded',
    () => {
        injectCitizenProfileCSS();
        checkLogin();
    }
);