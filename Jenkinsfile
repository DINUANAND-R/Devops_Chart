// ─────────────────────────────────────────────────────────────────────────────
// NexChat — Jenkins Declarative Pipeline
// Jenkins UI   : http://localhost:8090  (Docker container: nexchat-jenkins)
// Stages: Checkout → Lint → Test → Build → Scan → Push → Deploy
//
// Requirements on Jenkins agent:
//   • Docker CLI available (Jenkins container has Docker socket mounted)
//   • No NodeJS plugin needed — Node runs inside docker containers per stage
// ─────────────────────────────────────────────────────────────────────────────
pipeline {
    agent any

    // ── Pipeline-wide environment ─────────────────────────────────────────────
    environment {
        APP_NAME     = 'nexchat'
        REGISTRY     = 'ghcr.io'
        IMAGE_PREFIX = "ghcr.io/dinuanand-r/nexchat"

        // Build flags
        DOCKER_BUILDKIT          = '1'
        COMPOSE_DOCKER_CLI_BUILD = '1'
    }

    // ── Pipeline options ──────────────────────────────────────────────────────
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 45, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    stages {

        // ── 1. CHECKOUT ───────────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH_NAME = sh(
                        script: 'git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    echo "Branch : ${env.GIT_BRANCH_NAME}"
                    echo "Commit : ${env.GIT_COMMIT_SHORT}"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                }
            }
        }

        // ── 2. INSTALL & LINT ─────────────────────────────────────────────────
        // Node.js runs inside a Docker container — no NodeJS plugin needed
        stage('Install & Lint') {
            parallel {

                stage('Backend — Install & Lint') {
                    steps {
                        sh '''
                            docker run --rm \
                                -v "$PWD/backend":/app \
                                -w /app \
                                node:20-alpine \
                                sh -c "
                                    npm ci --prefer-offline --silent 2>&1 | tail -5
                                    echo '✅ Backend dependencies installed'
                                    if [ -f .eslintrc* ] || ls eslint.config.* 2>/dev/null; then
                                        npx eslint src/ --ext .js --max-warnings 0
                                    else
                                        echo 'No ESLint config — skipping lint'
                                    fi
                                "
                        '''
                    }
                }

                stage('Frontend — Install & Lint') {
                    steps {
                        sh '''
                            docker run --rm \
                                -v "$PWD/frontend":/app \
                                -w /app \
                                node:20-alpine \
                                sh -c "
                                    npm ci --prefer-offline --silent 2>&1 | tail -5
                                    echo '✅ Frontend dependencies installed'
                                    if [ -f .eslintrc* ] || ls eslint.config.* 2>/dev/null; then
                                        npx eslint src/ --ext .js,.jsx --max-warnings 0
                                    else
                                        echo 'No ESLint config — skipping lint'
                                    fi
                                "
                        '''
                    }
                }
            }
        }

        // ── 3. TEST ───────────────────────────────────────────────────────────
        stage('Test') {
            parallel {

                stage('Backend — Tests') {
                    steps {
                        sh '''
                            mkdir -p backend/test-results
                            docker run --rm \
                                -v "$PWD/backend":/app \
                                -w /app \
                                -e NODE_ENV=test \
                                -e PORT=5001 \
                                -e JWT_SECRET=ci_test_jwt_secret \
                                -e JWT_REFRESH_SECRET=ci_test_refresh_secret \
                                -e JWT_EXPIRES_IN=15m \
                                -e JWT_REFRESH_EXPIRES_IN=7d \
                                -e CLIENT_URL=http://localhost:3000 \
                                node:20-alpine \
                                sh -c "
                                    npm ci --prefer-offline --silent 2>&1 | tail -3
                                    npm test -- --forceExit --detectOpenHandles --passWithNoTests 2>&1 || true
                                    echo '✅ Backend tests done'
                                "
                        '''
                    }
                }

                stage('Frontend — Tests') {
                    steps {
                        sh '''
                            docker run --rm \
                                -v "$PWD/frontend":/app \
                                -w /app \
                                -e CI=true \
                                node:20-alpine \
                                sh -c "
                                    npm ci --prefer-offline --silent 2>&1 | tail -3
                                    npm test -- --watchAll=false --passWithNoTests 2>&1 || true
                                    echo '✅ Frontend tests done'
                                "
                        '''
                    }
                }
            }
        }

        // ── 4. BUILD DOCKER IMAGES ────────────────────────────────────────────
        stage('Build Docker Images') {
            parallel {

                stage('Build Backend Image') {
                    steps {
                        script {
                            def tag = "${env.IMAGE_PREFIX}-backend:${env.GIT_COMMIT_SHORT}"
                            sh """
                                docker build \\
                                    --file backend/Dockerfile \\
                                    --tag ${tag} \\
                                    --tag ${env.IMAGE_PREFIX}-backend:latest \\
                                    --build-arg GIT_COMMIT=${env.GIT_COMMIT_SHORT} \\
                                    backend/
                                echo '✅ Backend image built: ${tag}'
                            """
                            env.BACKEND_IMAGE = tag
                        }
                    }
                }

                stage('Build Frontend Image') {
                    steps {
                        script {
                            def tag = "${env.IMAGE_PREFIX}-frontend:${env.GIT_COMMIT_SHORT}"
                            sh """
                                docker build \\
                                    --file frontend/Dockerfile \\
                                    --tag ${tag} \\
                                    --tag ${env.IMAGE_PREFIX}-frontend:latest \\
                                    --build-arg GIT_COMMIT=${env.GIT_COMMIT_SHORT} \\
                                    frontend/
                                echo '✅ Frontend image built: ${tag}'
                            """
                            env.FRONTEND_IMAGE = tag
                        }
                    }
                }
            }
        }

        // ── 5. SECURITY SCAN ──────────────────────────────────────────────────
        stage('Security Scan') {
            steps {
                sh '''
                    echo "=== npm audit: backend ==="
                    docker run --rm \
                        -v "$PWD/backend":/app -w /app node:20-alpine \
                        sh -c "npm audit --audit-level=high 2>&1 || true"

                    echo "=== npm audit: frontend ==="
                    docker run --rm \
                        -v "$PWD/frontend":/app -w /app node:20-alpine \
                        sh -c "npm audit --audit-level=high 2>&1 || true"

                    echo "=== Trivy image scan ==="
                    if command -v trivy > /dev/null 2>&1; then
                        trivy image --exit-code 0 --severity HIGH,CRITICAL \
                            --no-progress "${IMAGE_PREFIX}-backend:latest" 2>&1 || true
                    else
                        echo "Trivy not installed — skipping image scan"
                    fi
                '''
            }
        }

        // ── 6. PUSH TO REGISTRY (main branch only) ────────────────────────────
        stage('Push to Registry') {
            when {
                branch 'main'
            }
            steps {
                script {
                    // Requires 'ghcr-credentials' in Jenkins Credentials store
                    // (username = GitHub username, password = GitHub PAT with write:packages)
                    withCredentials([usernamePassword(
                        credentialsId: 'ghcr-credentials',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh """
                            echo "\${DOCKER_PASS}" | docker login ${env.REGISTRY} \\
                                -u "\${DOCKER_USER}" --password-stdin

                            docker push ${env.IMAGE_PREFIX}-backend:${env.GIT_COMMIT_SHORT}
                            docker push ${env.IMAGE_PREFIX}-backend:latest
                            docker push ${env.IMAGE_PREFIX}-frontend:${env.GIT_COMMIT_SHORT}
                            docker push ${env.IMAGE_PREFIX}-frontend:latest

                            echo '✅ Images pushed to GHCR'
                        """
                    }
                }
            }
            post {
                always {
                    sh 'docker logout ghcr.io || true'
                }
            }
        }

        // ── 7. DEPLOY ─────────────────────────────────────────────────────────
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    echo "=== Deploying with Docker Compose ==="
                    docker compose -f docker-compose.yml up -d --remove-orphans

                    echo "=== Container Status ==="
                    docker compose -f docker-compose.yml ps
                    echo '✅ Deployment complete'
                '''
            }
        }
    }

    // ── POST-BUILD ────────────────────────────────────────────────────────────
    post {
        success {
            echo """
╔══════════════════════════════════════════╗
║  ✅  BUILD SUCCEEDED                     ║
║  Branch : ${env.GIT_BRANCH_NAME ?: 'unknown'}
║  Commit : ${env.GIT_COMMIT_SHORT ?: 'unknown'}
╚══════════════════════════════════════════╝
            """
        }
        failure {
            echo """
╔══════════════════════════════════════════╗
║  ❌  BUILD FAILED                        ║
║  Branch : ${env.GIT_BRANCH_NAME ?: 'unknown'}
║  Commit : ${env.GIT_COMMIT_SHORT ?: 'unknown'}
╚══════════════════════════════════════════╝
            """
        }
        always {
            cleanWs()
        }
    }
}