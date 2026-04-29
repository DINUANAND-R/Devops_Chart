// ─────────────────────────────────────────────────────────────────────────────
// NexChat — Jenkins Declarative Pipeline
// Jenkins UI   : http://localhost:8090  (Docker container: nexchat-jenkins)
// Stages: Checkout → Lint → Test → Build → Scan → Push → Deploy → Notify
// ─────────────────────────────────────────────────────────────────────────────
pipeline {
    agent any

    // ── Tool versions ─────────────────────────────────────────────────────────
    tools {
        nodejs 'Node-20'   // Configure this in Jenkins → Global Tool Configuration
    }

    // ── Pipeline-wide environment ─────────────────────────────────────────────
    environment {
        APP_NAME       = 'nexchat'
        REGISTRY       = 'ghcr.io'
        IMAGE_PREFIX   = "ghcr.io/${env.GITHUB_ACTOR ?: 'dinuanand-r'}/nexchat"
        IMAGE_TAG      = "${env.GIT_COMMIT?.take(7) ?: 'latest'}"

        // Jenkins credential IDs — configure these in Jenkins → Credentials
        GITHUB_CREDS   = credentials('github-credentials')
        DOCKER_CREDS   = credentials('ghcr-credentials')
        DEPLOY_SSH     = credentials('deploy-ssh-key')

        // Build flags
        DOCKER_BUILDKIT          = '1'
        COMPOSE_DOCKER_CLI_BUILD = '1'
    }

    // ── Pipeline options ──────────────────────────────────────────────────────
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    // ── Only build main & develop branches on push; PRs to main ──────────────
    triggers {
        githubPush()
    }

    stages {

        // ── 1. CHECKOUT ───────────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.GIT_BRANCH_NAME  = sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim()
                    echo "Branch: ${env.GIT_BRANCH_NAME} | Commit: ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        // ── 2. INSTALL & LINT (parallel: backend + frontend) ─────────────────
        stage('Install & Lint') {
            parallel {
                stage('Backend — Install & Lint') {
                    steps {
                        dir('backend') {
                            sh 'npm ci --prefer-offline'
                            // Run eslint if config exists; skip gracefully if not
                            sh '''
                                if [ -f .eslintrc* ] || [ -f eslint.config.*  ]; then
                                    npx eslint src/ --ext .js --max-warnings 0
                                else
                                    echo "No ESLint config found — skipping lint"
                                fi
                            '''
                        }
                    }
                }
                stage('Frontend — Install & Lint') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci --prefer-offline'
                            sh '''
                                if [ -f .eslintrc* ] || [ -f eslint.config.* ]; then
                                    npx eslint src/ --ext .js,.jsx,.ts,.tsx --max-warnings 0
                                else
                                    echo "No ESLint config found — skipping lint"
                                fi
                            '''
                        }
                    }
                }
            }
        }

        // ── 3. TEST (parallel: backend + frontend) ────────────────────────────
        stage('Test') {
            parallel {
                stage('Backend — Unit & Integration Tests') {
                    environment {
                        NODE_ENV             = 'test'
                        PORT                 = '5001'
                        MONGO_URI            = 'mongodb://localhost:27017/nexchat_test'
                        REDIS_URL            = 'redis://localhost:6379'
                        JWT_SECRET           = 'ci_test_jwt_secret_do_not_use_in_prod'
                        JWT_REFRESH_SECRET   = 'ci_test_refresh_secret_do_not_use'
                        JWT_EXPIRES_IN       = '15m'
                        JWT_REFRESH_EXPIRES_IN = '7d'
                        CLIENT_URL           = 'http://localhost:3000'
                    }
                    steps {
                        dir('backend') {
                            sh '''
                                npm test -- \
                                    --forceExit \
                                    --detectOpenHandles \
                                    --reporters=default \
                                    --reporters=jest-junit \
                                    --outputFile=test-results/junit.xml || true
                            '''
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true,
                                  testResults: 'backend/test-results/junit.xml'
                        }
                    }
                }
                stage('Frontend — React Tests') {
                    environment {
                        CI = 'true'
                    }
                    steps {
                        dir('frontend') {
                            sh 'npm test -- --watchAll=false --passWithNoTests'
                        }
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
                            def backendImage = "${env.IMAGE_PREFIX}-backend:${env.GIT_COMMIT_SHORT}"
                            sh """
                                docker build \
                                    --file backend/Dockerfile \
                                    --tag ${backendImage} \
                                    --tag ${env.IMAGE_PREFIX}-backend:latest \
                                    --build-arg BUILD_DATE=\$(date -u +%Y-%m-%dT%H:%M:%SZ) \
                                    --build-arg GIT_COMMIT=${env.GIT_COMMIT_SHORT} \
                                    --cache-from ${env.IMAGE_PREFIX}-backend:latest \
                                    backend/
                            """
                            env.BACKEND_IMAGE = backendImage
                        }
                    }
                }
                stage('Build Frontend Image') {
                    steps {
                        script {
                            def frontendImage = "${env.IMAGE_PREFIX}-frontend:${env.GIT_COMMIT_SHORT}"
                            sh """
                                docker build \
                                    --file frontend/Dockerfile \
                                    --tag ${frontendImage} \
                                    --tag ${env.IMAGE_PREFIX}-frontend:latest \
                                    --build-arg BUILD_DATE=\$(date -u +%Y-%m-%dT%H:%M:%SZ) \
                                    --build-arg GIT_COMMIT=${env.GIT_COMMIT_SHORT} \
                                    --cache-from ${env.IMAGE_PREFIX}-frontend:latest \
                                    frontend/
                            """
                            env.FRONTEND_IMAGE = frontendImage
                        }
                    }
                }
            }
        }

        // ── 5. SECURITY SCAN ──────────────────────────────────────────────────
        stage('Security Scan') {
            parallel {
                stage('npm audit — Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm audit --audit-level=high --json > audit-backend.json || true'
                        }
                    }
                }
                stage('npm audit — Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm audit --audit-level=high --json > audit-frontend.json || true'
                        }
                    }
                }
                stage('Trivy — Image Scan') {
                    steps {
                        script {
                            // Trivy must be installed on the Jenkins agent
                            sh """
                                if command -v trivy &> /dev/null; then
                                    trivy image \
                                        --exit-code 0 \
                                        --severity HIGH,CRITICAL \
                                        --no-progress \
                                        --format table \
                                        ${env.BACKEND_IMAGE}
                                else
                                    echo "Trivy not installed — skipping container scan"
                                fi
                            """
                        }
                    }
                }
            }
        }

        // ── 6. PUSH TO REGISTRY (main branch only) ────────────────────────────
        stage('Push to Registry') {
            when {
                branch 'main'
            }
            steps {
                script {
                    sh "echo \${DOCKER_CREDS_PSW} | docker login ${env.REGISTRY} -u \${DOCKER_CREDS_USR} --password-stdin"
                    sh """
                        docker push ${env.IMAGE_PREFIX}-backend:${env.GIT_COMMIT_SHORT}
                        docker push ${env.IMAGE_PREFIX}-backend:latest
                        docker push ${env.IMAGE_PREFIX}-frontend:${env.GIT_COMMIT_SHORT}
                        docker push ${env.IMAGE_PREFIX}-frontend:latest
                    """
                }
            }
            post {
                always {
                    sh 'docker logout ghcr.io || true'
                }
            }
        }

        // ── 7. DEPLOY (main branch only) ──────────────────────────────────────
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    // Local Docker Compose deploy
                    // For Kubernetes: replace with `kubectl set image ...`
                    sh """
                        export IMAGE_TAG=${env.GIT_COMMIT_SHORT}
                        docker compose -f docker-compose.prod.yml pull
                        docker compose -f docker-compose.prod.yml up -d --remove-orphans
                        docker compose -f docker-compose.prod.yml ps
                    """

                    // Verify all services healthy
                    sh '''
                        echo "Waiting for services to become healthy..."
                        sleep 15
                        docker compose -f docker-compose.prod.yml ps --format json | \
                            grep -q '"Health":"healthy"' || \
                            echo "Warning: some services may not be healthy yet"
                    '''

                    // Prune dangling images to free space
                    sh 'docker image prune -f'
                }
            }
        }
    }

    // ── POST-BUILD ACTIONS ────────────────────────────────────────────────────
    post {
        success {
            echo """
╔══════════════════════════════════════╗
║  ✅ BUILD SUCCEEDED                  ║
║  Branch  : ${env.GIT_BRANCH_NAME}   ║
║  Commit  : ${env.GIT_COMMIT_SHORT}  ║
║  Duration: ${currentBuild.durationString} ║
╚══════════════════════════════════════╝
            """
        }
        failure {
            echo """
╔══════════════════════════════════════╗
║  ❌ BUILD FAILED                     ║
║  Branch  : ${env.GIT_BRANCH_NAME}   ║
║  Commit  : ${env.GIT_COMMIT_SHORT}  ║
║  Stage   : ${env.STAGE_NAME}        ║
╚══════════════════════════════════════╝
            """
            // Uncomment and configure for email notifications:
            // mail to: 'team@example.com',
            //      subject: "FAILED: ${env.APP_NAME} #${env.BUILD_NUMBER}",
            //      body: "Build ${env.BUILD_URL} failed at stage ${env.STAGE_NAME}"
        }
        always {
            // Archive audit reports
            archiveArtifacts artifacts: '**/audit-*.json',
                             allowEmptyArchive: true
            // Clean workspace to free disk space
            cleanWs()
        }
    }
}