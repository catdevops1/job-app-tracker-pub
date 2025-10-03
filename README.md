# Job Application Tracker

A Kubernetes-native job application tracking system with user authentication, designed for production deployment on Kubernetes clusters with enterprise-grade security and scalability.

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Kubernetes](https://img.shields.io/badge/Platform-Kubernetes-blue)
![React](https://img.shields.io/badge/Frontend-React-61dafb)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791)
![JWT](https://img.shields.io/badge/Auth-JWT-000000)

## Features

### Core Application
- **Multi-User Authentication**: JWT-based user registration and login system
- **Application Management**: Add, edit, delete, and view job applications
- **Status Tracking**: Track progress through application pipeline (Applied → Interview → Offer/Rejected)
- **Search & Filter**: Find applications by company name, status, or other criteria
- **Analytics Dashboard**: View statistics about your job search progress
- **Data Isolation**: Each user sees only their own job applications

### Kubernetes-Native Features
- **Persistent Storage**: PostgreSQL with persistent volumes
- **Auto-scaling**: Horizontal pod autoscaler handles traffic spikes
- **Health Checks**: Comprehensive liveness and readiness probes
- **Resource Management**: CPU and memory limits with requests
- **Rolling Updates**: Zero-downtime deployments with Kubernetes
- **Container Security**: Non-root containers with dedicated user accounts
- **GitOps Ready**: ArgoCD integration for automated deployments

## Architecture

### Technology Stack
- **Frontend**: React 18 with Tailwind CSS
- **Backend**: Node.js/Express REST API with JWT authentication  
- **Database**: PostgreSQL 15 with persistent volumes
- **Authentication**: JSON Web Tokens (JWT) with bcrypt password hashing
- **Container Registry**: GitHub Container Registry (GHCR) or your preferred registry
- **Orchestration**: Kubernetes with ArgoCD GitOps
- **Ingress**: NGINX with Let's Encrypt SSL certificates

### Kubernetes Infrastructure Requirements
- Kubernetes cluster (v1.24+ recommended)
- NGINX Ingress Controller
- cert-manager for SSL certificates
- Container runtime (containerd/Docker)
- Persistent storage capability (StorageClass)
- Cluster autoscaler (recommended for production)

## Quick Start

### Prerequisites
- Kubernetes cluster with kubectl access
- Docker for building images
- Container registry credentials

### Deployment Steps

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/job-app-tracker-pub.git
cd job-app-tracker-pub

# 2. Create namespace
kubectl create namespace job-tracker

# 3. Create secrets
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=YOUR_DB_USER \
  --from-literal=POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD \
  --from-literal=POSTGRES_DB=jobtracker \
  --namespace=job-tracker

kubectl create secret generic jwt-secret \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --namespace=job-tracker

# 4. Update image references in k8s/*.yaml files to match your registry

# 5. Deploy
kubectl apply -f k8s/

# 6. Verify
kubectl get pods -n job-tracker
```

## Kubernetes Configuration

### Resource Specifications
```yaml
# Backend Pod Resources
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# Frontend Pod Resources  
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"

# PostgreSQL Resources
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Auto-scaling Configuration
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: job-tracker-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: job-tracker-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Persistent Storage
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: job-tracker
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

## Security

### ⚠️ Important Security Notes
- **Never commit secrets** to version control
- Store all credentials in Kubernetes Secrets
- Use strong, randomly generated passwords
- Rotate secrets regularly
- Enable RBAC on your cluster
- Scan container images for vulnerabilities

### Pod Security
- Non-root containers (uid 1001)
- Security contexts applied to all pods
- Resource limits prevent resource exhaustion
- Read-only root filesystem where applicable

### Network Security
- Network policies for pod-to-pod communication (recommended)
- SSL/TLS with Let's Encrypt certificates
- Private registry with pull secrets

### Authentication Security
- JWT tokens with secure signing
- bcrypt password hashing (12 rounds)
- Rate limiting for brute force protection
- Complete database isolation per user

## Monitoring

### Health Checks
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Useful Commands
```bash
# Check status
kubectl get all -n job-tracker

# View logs
kubectl logs -n job-tracker -l app=job-tracker-backend -f

# Monitor resources
kubectl top pods -n job-tracker

# Check autoscaling
kubectl get hpa -n job-tracker
```

## Database

### Schema
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  job_url TEXT,
  location VARCHAR(255),
  salary_range VARCHAR(100),
  application_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'applied',
  description TEXT,
  requirements TEXT,
  notes TEXT,
  contact_person VARCHAR(255),
  contact_email VARCHAR(255),
  follow_up_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Database Operations
```bash
# Access database
kubectl exec -it deployment/postgres -n job-tracker -- psql -U YOUR_DB_USER -d jobtracker

# Backup
kubectl exec deployment/postgres -n job-tracker -- pg_dump -U YOUR_DB_USER jobtracker > backup.sql

# Restore
kubectl exec -i deployment/postgres -n job-tracker -- psql -U YOUR_DB_USER jobtracker < backup.sql
```

## Troubleshooting

### Pods Stuck in Pending
```bash
kubectl describe pod <pod-name> -n job-tracker
kubectl get pv,pvc -n job-tracker
```

### Image Pull Errors
```bash
kubectl get secret registry-secret -n job-tracker
kubectl describe pod <pod-name> -n job-tracker
```

### Database Connection Issues
```bash
kubectl logs deployment/postgres -n job-tracker
kubectl get svc -n job-tracker
```

### Ingress Not Working
```bash
kubectl describe ingress -n job-tracker
kubectl get certificate -n job-tracker
```

## Production Considerations

### Scaling
- Configure HPA based on traffic patterns
- Adjust resource requests/limits from monitoring data
- Consider database read replicas for high traffic
- Use cluster autoscaler for node management

### Backup Strategy
- Automated daily database backups (CronJob)
- Regular PV snapshots
- Version control for all manifests
- Container image versioning with tags

### Security Hardening
- Implement network policies
- Apply pod security standards
- Use RBAC for cluster access
- Regular vulnerability scanning
- Consider external secret managers (Vault, AWS Secrets Manager)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Test changes in Kubernetes environment
4. Validate manifests: `kubectl apply --dry-run=client -f k8s/`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Security**: Report security vulnerabilities via private disclosure

---

**Built with Kubernetes-native principles for production-grade scalability and reliability.**