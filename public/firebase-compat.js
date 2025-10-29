// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMBZVW_B0VuHNURn_85EhyRmdEB6Ls390",
  authDomain: "aviator-simulator-4de09.firebaseapp.com",
  projectId: "aviator-simulator-4de09",
  storageBucket: "aviator-simulator-4de09.firebasestorage.app",
  messagingSenderId: "474026505293",
  appId: "1:474026505293:web:913fa95efa69672513d804",
  measurementId: "G-Q2FRQ36Z1Y"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
const auth = firebase.auth();
const db = firebase.firestore();

class FirebaseApp {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.initFirebase();
    }

    initFirebase() {
        try {
            console.log('🔥 Firebase initialized successfully');
            this.isInitialized = true;
            this.setupAuthListeners();
            setTimeout(() => this.setupUIListeners(), 100);
            
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
        }
    }

    setupAuthListeners() {
        auth.onAuthStateChanged((user) => {
            console.log('🔐 Auth state changed:', user);
            this.currentUser = user;
            this.updateAuthUI();
            
            if (user) {
                console.log('✅ User signed in:', user.displayName || 'Anonymous');
                this.loadUserData();
                this.trackEvent('login', { method: user.isAnonymous ? 'anonymous' : 'google' });
            } else {
                console.log('🚪 User signed out');
                this.signInAnonymously();
            }
        });
    }

    setupUIListeners() {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.signInWithGoogle());
        } else {
            console.log('⚠️ Login button not found');
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.signOut());
        } else {
            console.log('⚠️ Logout button not found');
        }
        
        console.log('✅ Firebase UI listeners setup complete');
    }

    updateAuthUI() {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const usernameSpan = document.getElementById('username');

        if (loginBtn && logoutBtn && usernameSpan) {
            if (this.currentUser) {
                usernameSpan.textContent = this.currentUser.displayName || 'Anonymous';
                loginBtn.style.display = 'none';
                logoutBtn.style.display = 'block';
                console.log('✅ Auth UI updated: User logged in');
            } else {
                usernameSpan.textContent = 'Guest';
                loginBtn.style.display = 'block';
                logoutBtn.style.display = 'none';
                console.log('✅ Auth UI updated: User logged out');
            }
        } else {
            console.log('⚠️ Auth UI elements not found');
        }
    }

    async signInAnonymously() {
        try {
            const result = await auth.signInAnonymously();
            console.log('✅ Anonymous sign-in successful:', result.user.uid);
            this.trackEvent('anonymous_signin');
            return result;
        } catch (error) {
            console.error('❌ Anonymous sign-in failed:', error);
            this.showAuthError('Failed to sign in anonymously');
        }
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            
            const result = await auth.signInWithPopup(provider);
            console.log('✅ Google sign-in successful:', result.user.displayName);
            this.trackEvent('google_signin', { username: result.user.displayName });
            return result;
        } catch (error) {
            console.error('❌ Google sign-in failed:', error);
            this.showAuthError('Google sign-in failed: ' + error.message);
        }
    }

    async signOut() {
        try {
            await auth.signOut();
            console.log('✅ Sign-out successful');
            this.trackEvent('logout');
        } catch (error) {
            console.error('❌ Sign-out failed:', error);
        }
    }

    async loadUserData() {
        if (!this.currentUser) return;

        try {
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log('📊 Loaded user data:', userData);
                
                // Update game balance from Firebase data
                if (window.aviatorGame && userData.coins !== undefined) {
                    window.aviatorGame.updateBalanceFromFirebase(userData.coins);
                }
            } else {
                console.log('📝 Creating new user document');
                await this.saveScore(this.currentUser.displayName || 'Anonymous', 1000);
            }
        } catch (error) {
            console.error('❌ Error loading user data:', error);
        }
    }

    async saveScore(username, coins) {
        if (!this.currentUser) {
            console.log('⚠️ User not authenticated, saving locally only');
            return;
        }

        try {
            const userData = {
                uid: this.currentUser.uid,
                username: username,
                coins: coins,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                email: this.currentUser.email || null,
                photoURL: this.currentUser.photoURL || null,
                lastLogin: new Date().toISOString()
            };

            await db.collection('users').doc(this.currentUser.uid).set(userData, { merge: true });
            console.log('💾 Score saved successfully for user:', username);
            this.trackEvent('score_saved', { coins: coins });
            
            // Refresh leaderboard after a short delay
            setTimeout(() => this.getLeaderboard(), 1000);
            
        } catch (error) {
            console.error('❌ Error saving score:', error);
        }
    }

    async getLeaderboard() {
        try {
            console.log('📊 Fetching leaderboard...');
            const snapshot = await db.collection('users')
                .orderBy('coins', 'desc')
                .limit(15)
                .get();

            console.log('✅ Leaderboard data received:', snapshot.docs.length, 'users');
            this.displayLeaderboard(snapshot.docs);
            this.trackEvent('leaderboard_view');
        } catch (error) {
            console.error('❌ Error fetching leaderboard:', error);
            this.displayLeaderboardError();
        }
    }

    displayLeaderboard(docs) {
        const leaderboardElement = document.getElementById('leaderboard');
        if (!leaderboardElement) {
            console.log('⚠️ Leaderboard element not found');
            return;
        }
        
        if (!docs || docs.length === 0) {
            leaderboardElement.innerHTML = '<div class="loading">🎮 No scores yet. Be the first to play!</div>';
            return;
        }

        let leaderboardHTML = '';
        
        docs.forEach((doc, index) => {
            const data = doc.data();
            const isCurrentUser = this.currentUser && data.uid === this.currentUser.uid;
            const userClass = isCurrentUser ? 'current-user' : '';
            
            leaderboardHTML += `
                <div class="leaderboard-item ${userClass}">
                    <span class="leaderboard-rank">#${index + 1}</span>
                    <span class="leaderboard-name">
                        ${this.escapeHtml(data.username)}
                        ${isCurrentUser ? ' 👤' : ''}
                    </span>
                    <span class="leaderboard-score">${this.formatNumber(data.coins)} coins</span>
                </div>
            `;
        });

        leaderboardElement.innerHTML = leaderboardHTML;
        console.log('✅ Leaderboard updated with', docs.length, 'users');
    }

    displayLeaderboardError() {
        const leaderboardElement = document.getElementById('leaderboard');
        if (leaderboardElement) {
            leaderboardElement.innerHTML = '<div class="loading">❌ Error loading leaderboard. Please try again.</div>';
        }
    }

    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    showAuthError(message) {
        console.error('🔐 Auth Error:', message);
        const statusElement = document.getElementById('statusMessage');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = '#ff6b6b';
        }
    }

    trackEvent(eventName, params = {}) {
        try {
            if (analytics) {
                analytics.logEvent(eventName, params);
            }
        } catch (error) {
            console.log('📊 Analytics event failed:', error);
        }
    }

    escapeHtml(unsafe) {
        if (!unsafe) return 'Anonymous';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize Firebase app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing Firebase...');
    window.firebaseApp = new FirebaseApp();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    console.log('🚀 DOM already ready, initializing Firebase...');
    window.firebaseApp = new FirebaseApp();
}