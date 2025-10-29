class AviatorGame {
    constructor() {
        this.balance = parseInt(localStorage.getItem('userBalance')) || 1000;
        this.currentBet = 0;
        this.currentMultiplier = 1.0;
        this.crashPoint = 0;
        this.isGameRunning = false;
        this.animationId = null;
        this.startTime = 0;
        this.crashTimings = this.generateCrashTimings();
        this.gameStats = this.loadGameStats();
        this.autoPlayEnabled = false;
        this.autoCashoutMultiplier = 0;
        
        this.initializeElements();
        this.updateDisplay();
        this.loadLeaderboard();
        this.setupEventListeners();
    }

    // Generate 30 different crash timings from 3 to 22 seconds
    generateCrashTimings() {
        const timings = [];
        const minTime = 3000; // 3 seconds
        const maxTime = 22000; // 22 seconds
        
        for (let i = 0; i < 30; i++) {
            const baseTime = minTime + (i * (maxTime - minTime) / 30);
            const randomVariation = (Math.random() - 0.5) * 2000;
            const timing = Math.max(minTime, Math.min(maxTime, baseTime + randomVariation));
            timings.push(timing);
        }
        
        return timings.sort(() => Math.random() - 0.5);
    }

    loadGameStats() {
        return JSON.parse(localStorage.getItem('gameStats')) || {
            totalGames: 0,
            totalWins: 0,
            totalProfit: 0,
            highestMultiplier: 1.0,
            gamesPlayed: 0
        };
    }

    saveGameStats() {
        localStorage.setItem('gameStats', JSON.stringify(this.gameStats));
    }

    initializeElements() {
        // Core elements
        this.multiplierElement = document.getElementById('multiplier');
        this.multiplierValue = document.querySelector('.multiplier-value');
        this.balanceElement = document.getElementById('balance');
        this.betAmountElement = document.getElementById('betAmount');
        this.startBtn = document.getElementById('startBtn');
        this.cashoutBtn = document.getElementById('cashoutBtn');
        this.autoBtn = document.getElementById('autoBtn');
        this.statusMessage = document.getElementById('statusMessage');
        this.planeElement = document.querySelector('.animated-plane');
        this.crashIndicator = document.getElementById('crashIndicator');
        this.crashValue = document.getElementById('crashValue');

        // Stats elements
        this.currentBetElement = document.getElementById('currentBet');
        this.potentialWinElement = document.getElementById('potentialWin');
        this.highestMultiplierElement = document.getElementById('highestMultiplier');
        this.totalGamesElement = document.getElementById('totalGames');
        this.totalWinsElement = document.getElementById('totalWins');
        this.winRateElement = document.getElementById('winRate');
        this.totalProfitElement = document.getElementById('totalProfit');

        // Leaderboard
        this.leaderboardElement = document.getElementById('leaderboard');
        this.refreshLeaderboardBtn = document.getElementById('refreshLeaderboard');

        console.log('Game elements initialized');
    }

    setupEventListeners() {
        // Game control buttons
        this.startBtn.addEventListener('click', () => this.startGame());
        this.cashoutBtn.addEventListener('click', () => this.cashOut());
        this.autoBtn.addEventListener('click', () => this.toggleAutoPlay());
        this.refreshLeaderboardBtn.addEventListener('click', () => this.loadLeaderboard());

        // Bet controls
        this.betAmountElement.addEventListener('input', () => this.validateBet());
        document.querySelectorAll('.bet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.adjustBet(e.target.dataset.action));
        });

        // Quick bets
        document.querySelectorAll('.quick-bet').forEach(btn => {
            btn.addEventListener('click', (e) => this.setQuickBet(parseInt(e.target.dataset.amount)));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    handleKeyboard(e) {
        if (this.isGameRunning) {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.cashOut();
            }
        } else {
            if (e.code === 'Enter') {
                e.preventDefault();
                this.startGame();
            }
        }

        // Bet adjustments
        if (e.code === 'ArrowUp') {
            e.preventDefault();
            this.adjustBet('increase');
        } else if (e.code === 'ArrowDown') {
            e.preventDefault();
            this.adjustBet('decrease');
        }
    }

    adjustBet(action) {
        let currentBet = parseInt(this.betAmountElement.value) || 0;
        const step = action === 'increase' ? 10 : -10;
        const newBet = Math.max(1, Math.min(this.balance, currentBet + step));
        this.betAmountElement.value = newBet;
        this.updatePotentialWin();
    }

    setQuickBet(amount) {
        this.betAmountElement.value = Math.min(amount, this.balance);
        this.updatePotentialWin();
    }

    validateBet() {
        const bet = parseInt(this.betAmountElement.value) || 0;
        if (bet > this.balance) {
            this.betAmountElement.value = this.balance;
        }
        if (bet < 1) {
            this.betAmountElement.value = 1;
        }
        this.updatePotentialWin();
    }

    updatePotentialWin() {
        const bet = parseInt(this.betAmountElement.value) || 0;
        const potentialWin = Math.floor(bet * this.currentMultiplier);
        this.potentialWinElement.textContent = potentialWin;
    }

    startGame() {
        const betAmount = parseInt(this.betAmountElement.value);
        
        if (betAmount < 1) {
            this.showStatus("❌ Bet amount must be at least 1 coin", 'error');
            return;
        }
        
        if (betAmount > this.balance) {
            this.showStatus("❌ Insufficient balance", 'error');
            return;
        }

        if (this.isGameRunning) {
            this.showStatus("⚠️ Game is already running!", 'error');
            return;
        }

        // Deduct bet from balance
        this.currentBet = betAmount;
        this.balance -= this.currentBet;
        this.updateBalance();

        // Select random crash timing and calculate crash point
        const randomTiming = this.crashTimings[Math.floor(Math.random() * this.crashTimings.length)];
        this.crashPoint = this.calculateCrashPointFromTiming(randomTiming);
        
        this.currentMultiplier = 1.0;
        this.isGameRunning = true;
        this.startTime = Date.now();

        console.log(`Game started - Crash timing: ${(randomTiming/1000).toFixed(1)}s, Target multiplier: ${this.crashPoint.toFixed(2)}x`);

        // Update UI
        this.startBtn.disabled = true;
        this.cashoutBtn.disabled = false;
        this.betAmountElement.disabled = true;
        this.showStatus(`✈️ Game started! Plane is taking off... Good luck!`, 'info');

        // Update game stats
        this.gameStats.gamesPlayed++;
        this.updateStatsDisplay();

        // Show crash point
        this.crashValue.textContent = this.crashPoint.toFixed(2);
        this.crashIndicator.style.opacity = '1';

        // Reset plane position
        this.resetPlanePosition();

        // Start animation
        this.animateGame();
    }

    calculateCrashPointFromTiming(timingMs) {
        const timingSeconds = timingMs / 1000;
        const growthRate = 0.15;
        const baseMultiplier = Math.exp(growthRate * timingSeconds);
        const randomFactor = 0.9 + (Math.random() * 0.2);
        let multiplier = baseMultiplier * randomFactor;
        multiplier = Math.max(1.5, Math.min(20, multiplier));
        return multiplier;
    }

    resetPlanePosition() {
        if (this.planeElement) {
            this.planeElement.style.bottom = '40px';
            this.planeElement.style.left = '8%';
            this.planeElement.style.transform = 'translateX(0) scaleX(-1)';
        }
    }

    animateGame() {
        if (!this.isGameRunning) return;

        const elapsedTime = Date.now() - this.startTime;
        const progress = Math.min(1, elapsedTime / 10000);

        // Calculate multiplier growth (exponential with variation)
        const growthRate = 0.12 + (Math.sin(elapsedTime / 1000) * 0.02);
        this.currentMultiplier = Math.exp(growthRate * (elapsedTime / 1000));

        // Add some randomness to make it more exciting
        this.currentMultiplier *= (1 + (Math.random() - 0.5) * 0.01);

        // Update display
        this.updateMultiplierDisplay();
        this.updatePlanePosition(progress);
        this.updatePotentialWin();

        // Check for auto cashout
        if (this.autoPlayEnabled && this.autoCashoutMultiplier > 0 && 
            this.currentMultiplier >= this.autoCashoutMultiplier) {
            this.cashOut();
            return;
        }

        // Check for crash
        if (this.currentMultiplier >= this.crashPoint) {
            this.crash();
            return;
        }

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.animateGame());
    }

    updateMultiplierDisplay() {
        if (this.multiplierElement && this.multiplierValue) {
            this.multiplierValue.textContent = this.currentMultiplier.toFixed(2);
            
            // Remove all color classes
            this.multiplierElement.classList.remove('multiplier-safe', 'multiplier-warning', 'multiplier-danger', 'multiplier-glow');
            
            // Color coding based on multiplier with glow effects
            if (this.currentMultiplier >= 10) {
                this.multiplierElement.classList.add('multiplier-danger', 'multiplier-glow');
            } else if (this.currentMultiplier >= 5) {
                this.multiplierElement.classList.add('multiplier-warning', 'multiplier-glow');
            } else {
                this.multiplierElement.classList.add('multiplier-safe', 'multiplier-glow');
            }

            // Update highest multiplier
            if (this.currentMultiplier > this.gameStats.highestMultiplier) {
                this.gameStats.highestMultiplier = this.currentMultiplier;
                this.highestMultiplierElement.textContent = this.currentMultiplier.toFixed(2) + 'x';
            }
        }
    }

    updatePlanePosition(progress) {
        if (!this.planeElement) return;

        // Calculate flight path: bottom-left to top-right with slight curve
        const startBottom = 40;
        const endBottom = 85;
        const startLeft = 8;
        const endLeft = 88;

        // Add some curve to the flight path
        const curve = Math.sin(progress * Math.PI) * 5;
        const currentBottom = startBottom + (endBottom - startBottom) * progress + curve;
        const currentLeft = startLeft + (endLeft - startLeft) * progress;

        // Update plane position
        this.planeElement.style.bottom = `${currentBottom}%`;
        this.planeElement.style.left = `${currentLeft}%`;
        
        // Add banking/tilt effect during flight
        const tilt = Math.sin(progress * Math.PI * 4) * 20;
        const scale = 0.8 + (progress * 0.5);
        this.planeElement.style.transform = `translateX(0) scaleX(-1) rotate(${tilt}deg) scale(${scale})`;
        
        // Add engine intensity based on speed
        const engineIntensity = 0.5 + (progress * 0.5);
        this.planeElement.style.filter = `drop-shadow(2px 2px ${5 + engineIntensity * 5}px rgba(0,0,0,0.5))`;
    }

    cashOut() {
        if (!this.isGameRunning) {
            this.showStatus("⚠️ No active game to cash out from!", 'error');
            return;
        }

        const winnings = Math.floor(this.currentBet * this.currentMultiplier);
        this.balance += winnings;
        const profit = winnings - this.currentBet;
        
        // Update game stats
        this.gameStats.totalGames++;
        this.gameStats.totalWins++;
        this.gameStats.totalProfit += profit;

        this.endGame(`🎉 Amazing! Cashed out at ${this.currentMultiplier.toFixed(2)}x! Won ${winnings} coins! (+${profit})`, 'win');
        
        // Save score to leaderboard if user is authenticated
        if (window.firebaseApp && window.firebaseApp.currentUser) {
            const username = window.firebaseApp.currentUser.displayName || 'Anonymous';
            window.firebaseApp.saveScore(username, this.balance);
        }

        // Save game stats
        this.saveGameStats();
        this.updateStatsDisplay();

        // Celebration effect for big wins
        if (this.currentMultiplier >= 5) {
            this.triggerCelebration();
        }
    }

    crash() {
        // Update game stats
        this.gameStats.totalGames++;
        
        this.endGame(`💥 Crash! Lost at ${this.currentMultiplier.toFixed(2)}x! Lost ${this.currentBet} coins.`, 'crash');
        
        // Apply crash animation to multiplier
        if (this.multiplierElement) {
            this.multiplierElement.classList.add('crash-animation');
            setTimeout(() => {
                if (this.multiplierElement) {
                    this.multiplierElement.classList.remove('crash-animation');
                }
            }, 500);
        }

        // Save game stats
        this.saveGameStats();
        this.updateStatsDisplay();
    }

    endGame(message, type) {
        this.isGameRunning = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Update UI
        this.startBtn.disabled = false;
        this.cashoutBtn.disabled = true;
        this.betAmountElement.disabled = false;
        
        this.showStatus(message, type);
        this.updateBalance();

        // Hide crash indicator
        this.crashIndicator.style.opacity = '0.5';

        // Reset plane position after delay
        setTimeout(() => {
            this.resetPlanePosition();
            this.resetMultiplierDisplay();
        }, 1500);

        // Auto-play next round if enabled
        if (this.autoPlayEnabled && this.balance >= this.currentBet) {
            setTimeout(() => {
                this.startGame();
            }, 2000);
        }
    }

    resetMultiplierDisplay() {
        if (this.multiplierElement && this.multiplierValue) {
            this.multiplierValue.textContent = '1.00';
            this.multiplierElement.classList.remove('multiplier-warning', 'multiplier-danger', 'multiplier-glow');
            this.multiplierElement.classList.add('multiplier-safe');
        }
        this.currentBetElement.textContent = '0';
        this.potentialWinElement.textContent = '0';
    }

    toggleAutoPlay() {
        this.autoPlayEnabled = !this.autoPlayEnabled;
        
        if (this.autoPlayEnabled) {
            this.autoBtn.innerHTML = '<span class="btn-icon">⏹️</span> Stop Auto';
            this.autoBtn.classList.add('btn-danger');
            this.showStatus('⚡ Auto Play enabled! Next round will start automatically.', 'info');
            
            // Set auto cashout multiplier (random between 2x and 8x)
            this.autoCashoutMultiplier = 2 + Math.random() * 6;
        } else {
            this.autoBtn.innerHTML = '<span class="btn-icon">⚡</span> Auto Play';
            this.autoBtn.classList.remove('btn-danger');
            this.showStatus('🛑 Auto Play disabled.', 'info');
            this.autoCashoutMultiplier = 0;
        }
    }

    triggerCelebration() {
        // Add celebration class to status message
        this.statusMessage.classList.add('celebrate');
        
        // Create some celebration particles
        this.createParticles();
        
        // Remove celebration class after animation
        setTimeout(() => {
            this.statusMessage.classList.remove('celebrate');
        }, 1000);
    }

    createParticles() {
        const container = document.querySelector('.multiplier-display');
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.className = 'celebration-particle';
            particle.style.cssText = `
                position: absolute;
                width: 8px;
                height: 8px;
                background: gold;
                border-radius: 50%;
                top: 50%;
                left: 50%;
                pointer-events: none;
                z-index: 100;
            `;
            container.appendChild(particle);

            // Animate particle
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 100;
            const duration = 1000 + Math.random() * 1000;

            particle.animate([
                { 
                    transform: 'translate(-50%, -50%) scale(1)',
                    opacity: 1
                },
                { 
                    transform: `translate(-50%, -50%) translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: duration,
                easing: 'cubic-bezier(0.2, 0, 0.8, 1)'
            }).onfinish = () => particle.remove();
        }
    }

    showStatus(message, type) {
        if (!this.statusMessage) return;

        this.statusMessage.textContent = message;
        this.statusMessage.className = 'status-message';
        
        // Remove any existing status classes
        this.statusMessage.classList.remove('status-win', 'status-crash', 'status-info', 'status-error');
        
        // Add appropriate status class
        if (type === 'win') {
            this.statusMessage.classList.add('status-win', 'win-animation');
        } else if (type === 'crash') {
            this.statusMessage.classList.add('status-crash', 'crash-animation');
        } else if (type === 'error') {
            this.statusMessage.classList.add('status-error');
        } else {
            this.statusMessage.classList.add('status-info');
        }
    }

    updateBalance() {
        if (this.balanceElement) {
            this.balanceElement.textContent = this.balance;
        }
        localStorage.setItem('userBalance', this.balance.toString());
        
        // Update bet max value
        if (this.betAmountElement) {
            this.betAmountElement.max = this.balance;
        }
    }

    updateStatsDisplay() {
        if (this.totalGamesElement) {
            this.totalGamesElement.textContent = this.gameStats.gamesPlayed;
        }
        if (this.totalWinsElement) {
            this.totalWinsElement.textContent = this.gameStats.totalWins;
        }
        if (this.winRateElement) {
            const winRate = this.gameStats.totalGames > 0 
                ? Math.round((this.gameStats.totalWins / this.gameStats.totalGames) * 100)
                : 0;
            this.winRateElement.textContent = winRate + '%';
        }
        if (this.totalProfitElement) {
            this.totalProfitElement.textContent = this.gameStats.totalProfit;
        }
        if (this.highestMultiplierElement) {
            this.highestMultiplierElement.textContent = this.gameStats.highestMultiplier.toFixed(2) + 'x';
        }
        if (this.currentBetElement) {
            this.currentBetElement.textContent = this.isGameRunning ? this.currentBet : '0';
        }
    }

    updateDisplay() {
        this.updateBalance();
        this.updateStatsDisplay();
        this.resetMultiplierDisplay();
        
        // Set initial bet max value
        if (this.betAmountElement) {
            this.betAmountElement.max = this.balance;
        }
    }

    loadLeaderboard() {
        if (window.firebaseApp) {
            this.showStatus('🔄 Loading leaderboard...', 'info');
            setTimeout(() => {
                window.firebaseApp.getLeaderboard();
            }, 1000);
        } else {
            console.log('Firebase app not available for leaderboard');
            // Retry after 3 seconds
            setTimeout(() => this.loadLeaderboard(), 3000);
        }
    }

    // Method to update balance from Firebase
    updateBalanceFromFirebase(newBalance) {
        this.balance = newBalance;
        this.updateBalance();
        console.log('Balance updated from Firebase:', newBalance);
    }

    // Method to reset game (for testing)
    resetGame() {
        this.balance = 1000;
        this.currentBet = 0;
        this.currentMultiplier = 1.0;
        this.isGameRunning = false;
        this.autoPlayEnabled = false;
        this.autoCashoutMultiplier = 0;
        
        this.gameStats = {
            totalGames: 0,
            totalWins: 0,
            totalProfit: 0,
            highestMultiplier: 1.0,
            gamesPlayed: 0
        };
        
        this.updateBalance();
        this.updateDisplay();
        this.resetPlanePosition();
        this.saveGameStats();
        this.showStatus("🔄 Game reset to initial state", 'info');
        
        // Reset auto play button
        this.autoBtn.innerHTML = '<span class="btn-icon">⚡</span> Auto Play';
        this.autoBtn.classList.remove('btn-danger');
    }

    // Debug method to see available timings
    debugTimings() {
        console.log('Available crash timings (seconds):', 
            this.crashTimings.map(t => (t/1000).toFixed(1))
        );
    }
}

// Initialize game when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeGame();
    });
} else {
    initializeGame();
}

function initializeGame() {
    try {
        window.aviatorGame = new AviatorGame();
        console.log('🎮 Aviator Game Pro initialized successfully');
        
        // Add global reset function for testing
        window.resetGame = () => {
            if (window.aviatorGame) {
                window.aviatorGame.resetGame();
            }
        };
        
        // Add debug function
        window.debugTimings = () => {
            if (window.aviatorGame) {
                window.aviatorGame.debugTimings();
            }
        };
        
    } catch (error) {
        console.error('❌ Failed to initialize Aviator Game:', error);
    }
}