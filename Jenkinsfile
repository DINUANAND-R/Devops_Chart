pipeline {
    agent any

    environment {
        DOCKER_BUILDKIT = '0'
        COMPOSE_DOCKER_CLI_BUILD = '0'
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/DINUANAND-R/Devops_Chart.git'
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                sh '''
                docker compose -f docker-compose.prod.yml down || true
                docker compose -f docker-compose.prod.yml up -d --build
                docker ps
                '''
            }
        }
    }
}