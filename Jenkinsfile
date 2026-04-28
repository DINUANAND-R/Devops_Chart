pipeline {
    agent any

    stages {

        stage('Pull Code') {
            steps {
                git branch: 'main', url: 'https://github.com/DINUANAND-R/Devops_Chart'
            }
        }

        stage('Stop Old Containers') {
            steps {
                sh 'docker compose -f docker-compose.prod.yml down || true'
            }
        }

        stage('Build & Deploy') {
            steps {
                sh 'docker compose -f docker-compose.prod.yml up -d --build'
            }
        }

        stage('Verify') {
            steps {
                sh 'docker ps'
            }
        }
    }
}