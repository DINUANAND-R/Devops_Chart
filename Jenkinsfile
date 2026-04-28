pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/DINUANAND-R/Devops_Chart'
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                sh '''
                docker compose -f docker-compose.prod.yml down
                docker compose -f docker-compose.prod.yml up -d --build
                docker ps
                '''
            }
        }
    }
}