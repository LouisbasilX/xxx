class AIStudyMate {
    constructor() {
        this.token = localStorage.getItem('studyToken');
        this.user = JSON.parse(localStorage.getItem('studyUser') || 'null');
        
        this.initializeApp();
    }

    initializeApp() {
        if (this.token && this.user) {
            this.showAppScreen();
        } else {
            this.showAuthScreen();
        }

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Auth events
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('register-btn').addEventListener('click', () => this.register());
        document.getElementById('show-register').addEventListener('click', () => this.toggleAuthForms());
        document.getElementById('show-login').addEventListener('click', () => this.toggleAuthForms());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Study events
        document.getElementById('process-btn').addEventListener('click', () => this.processStudyMaterial());
        
        // Enter key support for auth forms
        document.getElementById('login-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        document.getElementById('register-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });

        // Add sample text for demo
        document.getElementById('study-text').value = this.getSampleText();
    }

    async login() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('studyToken', this.token);
                localStorage.setItem('studyUser', JSON.stringify(this.user));
                
                this.showAppScreen();
                this.showMessage('Login successful!', 'success');
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Login failed. Please try again.', 'error');
        }
    }

    async register() {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        if (!name || !email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('studyToken', this.token);
                localStorage.setItem('studyUser', JSON.stringify(this.user));
                
                this.showAppScreen();
                this.showMessage('Registration successful!', 'success');
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Registration failed. Please try again.', 'error');
        }
    }

    logout() {
        localStorage.removeItem('studyToken');
        localStorage.removeItem('studyUser');
        this.token = null;
        this.user = null;
        this.showAuthScreen();
        this.showMessage('Logged out successfully', 'success');
    }

    toggleAuthForms() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        loginForm.classList.toggle('hidden');
        registerForm.classList.toggle('hidden');
    }

    showAuthScreen() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
        
        // Clear auth forms
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('register-name').value = '';
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
    }

    showAppScreen() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        
        document.getElementById('user-name').textContent = this.user.name;
        this.loadStudyHistory();
    }

    async processStudyMaterial() {
        const text = document.getElementById('study-text').value.trim();
        if (text.length < 30) {
            this.showMessage('Please enter at least 30 characters of text', 'error');
            return;
        }

        const selectedFeatures = this.getSelectedFeatures();
        if (selectedFeatures.length === 0) {
            this.showMessage('Please select at least one AI feature', 'error');
            return;
        }

        this.setLoadingState(true);
        this.hideAllResults();

        try {
            const response = await fetch('/api/study/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    text: text,
                    features: selectedFeatures
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.displayResults(result);
                this.loadStudyHistory();
                this.showMessage('Study materials generated successfully!', 'success');
            } else {
                this.showMessage(result.error, 'error');
            }
        } catch (error) {
            this.showMessage('Failed to process study material', 'error');
        } finally {
            this.setLoadingState(false);
        }
    }

    getSelectedFeatures() {
        const checkboxes = document.querySelectorAll('input[name="features"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    displayResults(results) {
        // Show summary
        if (results.summary) {
            document.getElementById('summary-content').innerHTML = `
                <p class="text-gray-700">${results.summary}</p>
                <div class="mt-3 p-2 bg-white rounded border">
                    <small class="text-gray-500"><i class="fas fa-lightbulb mr-1"></i>AI-generated summary</small>
                </div>
            `;
            document.getElementById('summary-card').classList.remove('hidden');
        }

        // Show quiz
        if (results.quiz && results.quiz.length > 0) {
            document.getElementById('quiz-content').innerHTML = this.renderQuiz(results.quiz);
            document.getElementById('quiz-card').classList.remove('hidden');
        }

        // Show flashcards
        if (results.flashcards && results.flashcards.length > 0) {
            document.getElementById('flashcards-content').innerHTML = this.renderFlashcards(results.flashcards);
            document.getElementById('flashcards-card').classList.remove('hidden');
        }

        // Show key points
        if (results.keyPoints && results.keyPoints.length > 0) {
            document.getElementById('keypoints-content').innerHTML = this.renderKeyPoints(results.keyPoints);
            document.getElementById('keypoints-card').classList.remove('hidden');
        }
    }

    renderQuiz(quiz) {
        return quiz.map((q, index) => `
            <div class="quiz-item mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div class="font-semibold text-gray-800 mb-3">${q.question}</div>
                <div class="space-y-2">
                    ${q.options.map((option, optIndex) => `
                        <label class="flex items-center p-2 bg-white rounded border cursor-pointer hover:bg-green-100 transition-colors">
                            <input type="radio" name="quiz-${index}" value="${optIndex}" class="mr-3">
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
                <button onclick="app.checkAnswer(${index}, ${q.correct})" 
                        class="mt-3 w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors">
                    Check Answer
                </button>
                <div id="quiz-feedback-${index}" class="mt-2 hidden"></div>
            </div>
        `).join('');
    }

    renderFlashcards(flashcards) {
        return flashcards.map((card, index) => `
            <div class="flashcard bg-purple-50 rounded-lg border border-purple-200 overflow-hidden">
                <div class="flashcard-front p-4 border-b border-purple-200">
                    <div class="font-semibold text-purple-800">${card.front}</div>
                </div>
                <div class="flashcard-back p-4 bg-white hidden">
                    <div class="text-gray-700">${card.back}</div>
                </div>
                <button onclick="app.flipFlashcard(${index})" 
                        class="w-full bg-purple-500 text-white py-2 px-4 hover:bg-purple-600 transition-colors">
                    <i class="fas fa-sync-alt mr-2"></i>Flip Card
                </button>
            </div>
        `).join('');
    }

    renderKeyPoints(keyPoints) {
        return `
            <div class="space-y-2">
                ${keyPoints.map(point => `
                    <div class="flex items-start p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <span class="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full text-sm flex items-center justify-center mr-3 mt-1">
                            ${point.id}
                        </span>
                        <span class="text-gray-700">${point.point}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    checkAnswer(quizIndex, correctIndex) {
        const selected = document.querySelector(`input[name="quiz-${quizIndex}"]:checked`);
        const feedback = document.getElementById(`quiz-feedback-${quizIndex}`);
        
        if (!selected) {
            feedback.innerHTML = '<div class="text-red-500">Please select an answer first!</div>';
            feedback.classList.remove('hidden');
            return;
        }

        const userAnswer = parseInt(selected.value);
        const isCorrect = userAnswer === correctIndex;
        
        feedback.innerHTML = `
            <div class="p-3 rounded-lg ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'} mr-2"></i>
                ${isCorrect ? 'Correct! 🎉' : 'Not quite right. Try again!'}
            </div>
        `;
        feedback.classList.remove('hidden');
    }

    flipFlashcard(index) {
        const flashcards = document.querySelectorAll('.flashcard');
        const card = flashcards[index];
        const front = card.querySelector('.flashcard-front');
        const back = card.querySelector('.flashcard-back');
        
        if (front.classList.contains('hidden')) {
            front.classList.remove('hidden');
            back.classList.add('hidden');
        } else {
            front.classList.add('hidden');
            back.classList.remove('hidden');
        }
    }

    hideAllResults() {
        ['summary', 'quiz', 'flashcards', 'keypoints'].forEach(type => {
            document.getElementById(`${type}-card`).classList.add('hidden');
        });
    }

    setLoadingState(loading) {
        const button = document.getElementById('process-btn');
        if (loading) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-3"></i>Processing...';
            button.disabled = true;
        } else {
            button.innerHTML = '<i class="fas fa-robot mr-3"></i>Generate Study Materials';
            button.disabled = false;
        }
    }

    async loadStudyHistory() {
        try {
            const response = await fetch('/api/study/history', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.renderStudyHistory(data.sessions);
            }
        } catch (error) {
            console.error('Failed to load history');
        }
    }

    renderStudyHistory(sessions) {
        const container = document.getElementById('history-content');
        
        if (sessions.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No study sessions yet</p>';
            return;
        }

        container.innerHTML = sessions.map(session => `
            <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div class="text-sm text-gray-600 truncate mb-1">${session.originalText}</div>
                <div class="flex justify-between items-center text-xs text-gray-500">
                    <span>${new Date(session.timestamp).toLocaleDateString()}</span>
                    <div class="flex space-x-1">
                        ${Object.keys(session.results).map(feature => 
                            `<span class="px-1 bg-white rounded">${feature}</span>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    showMessage(message, type) {
        // Create toast message
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white ${
            type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } z-50 fade-in`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    getSampleText() {
        return `Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It involves algorithms that can identify patterns and make predictions based on input data. Common types include supervised learning, unsupervised learning, and reinforcement learning. Neural networks are a popular approach inspired by the human brain's structure and function.

Deep learning uses multiple layers to progressively extract higher-level features from raw input. For example, in image processing, lower layers may identify edges, while higher layers may identify concepts relevant to humans such as digits or faces.`;
    }
}

// Initialize the application
const app = new AIStudyMate();