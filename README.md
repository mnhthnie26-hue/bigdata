# Hệ thống phân tích hành vi người xem Livestream / Video Streaming App
## 1. Tổng quan hệ thống

Hệ thống phân tích hành vi người xem livestream được xây dựng dựa trên kiến trúc Big Data hiện đại, cho phép thu thập, xử lý, lưu trữ và hiển thị phân tích hành vi người xem trong thời gian thực.

### 1.1. Mục tiêu
- Theo dõi hành vi người xem thời gian thực (tương tác, chất lượng video, thiết bị)
- Phân tích xu hướng và sở thích người xem
- Phát hiện sớm các vấn đề chất lượng (buffer, lỗi, bitrate thấp)
- Hỗ trợ ra quyết định dựa trên dữ liệu

### 1.2. Kiến trúc tổng thể
```
Frontend (React + TS) → API (FastAPI) → Kafka → Flink → ClickHouse/PG
                              ↓           ↓        ↓
                             Redis      Metrics   Grafana
```

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ | Phiên bản | Mục đích |
|---|---|---|---|
| Message Queue | Apache Kafka | 7.5.0 | Thu thập events |
| Stream Processing | Apache Flink | 1.17 | Xử lý real-time |
| OLAP Database | ClickHouse | 23.8 | Lưu trữ metrics thời gian thực |
| Relational DB | PostgreSQL | 15 | Quản lý người dùng, streams, dashboards |
| Cache | Redis | 7 | Cache + rate limiting |
| API | FastAPI | 0.104.1 | REST API + WebSocket |
| Frontend | React + Vite | 18 + 5 | Dashboard UI |
| Monitoring | Prometheus + Grafana | 2.47 + 10.1 | Giám sát hệ thống |

## 3. Cấu trúc thư mục

```
M:\bigdata\
├── config/              # Cấu hình các dịch vụ
│   ├── kafka/           # Kafka config
│   ├── flink/           # Flink config
│   ├── clickhouse/      # ClickHouse config
│   ├── prometheus/      # Prometheus config
│   └── grafana/         # Grafana config
├── data/                # Dữ liệu persistent
├── docker/              # Dockerfiles
├── sql/                 # SQL schemas
├── src/                 # Source code
│   ├── api/             # FastAPI backend
│   ├── frontend/        # React frontend
│   ├── data-collection/ # Producers
│   └── stream-processing/ # Flink jobs
└── docker-compose.yml   # Full stack deployment
```

## 4. Khởi động hệ thống

### 4.1. Yêu cầu
- Docker Desktop (Windows)
- WSL2 hoặc Hyper-V
- 8GB+ RAM
- 20GB+ Disk

### 4.2. Chuẩn bị
```powershell
# Clone repo (nếu cần)
cd M:\bigdata

# Tạo thư mục dữ liệu
mkdir -p data\{zookeeper,kafka,clickhouse,postgres,redis,flink,prometheus,grafana}
```

### 4.3. Khởi động toàn bộ
```powershell
# Khởi động tất cả services
docker-compose up -d

# Kiểm tra trạng thái
docker-compose ps

# Xem logs
docker-compose logs -f api
```

### 4.4. Khởi động riêng từng component
```powershell
# Chỉ infrastructure
docker-compose up -d zookeeper kafka clickhouse postgres redis

# Chỉ API + Frontend
docker-compose up -d api frontend

# Chỉ Flink
docker-compose up -d flink-jobmanager flink-taskmanager
```

## 5. Các URL truy cập

| Service | URL | Mô tả | Credentials |
|---|---|---|---|
| Frontend Dashboard | http://localhost:3000 | Giao diện chính | admin@livestream.local / admin123 |
| API Docs | http://localhost:8000/docs | Swagger UI | Tùy chọn auth |
| API ReDoc | http://localhost:8000/redoc | API Documentation | - |
| Kafka UI | http://localhost:8080 | Quản lý Kafka topics | - |
| Flink UI | http://localhost:8081 | Flink JobManager | - |
| ClickHouse HTTP | http://localhost:8123 | ClickHouse UI/API | analytics/analytics_password |
| Prometheus | http://localhost:9090 | Monitoring metrics | - |
| Grafana | http://localhost:3001 | Dashboards | admin/admin |

## 6. Kiểm tra hệ thống

### 6.1. Kiểm tra API Health
```powershell
curl http://localhost:8000/health
```

### 6.2. Kiểm tra ClickHouse
```powershell
curl http://localhost:8123/ping
```

### 6.3. Kiểm tra Kafka
```powershell
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

### 6.4. Tạo dữ liệu test
```powershell
# Chạy data generator (optional)
docker-compose --profile testing up data-generator
```

## 7. Schema dữ liệu chính

### 7.1. ClickHouse (OLAP)
- `raw_events`: Lưu raw events (TTL 30 days)
- `realtime_metrics`: Metrics 1-minute (TTL 7 days)
- `hourly_stream_stats`: Aggregations hourly (2 years)
- `viewer_sessions`: Session aggregates
- `stream_catalog`: Stream metadata

### 7.2. PostgreSQL (OLTP)
- `users`: Tài khoản người dùng
- `streamers`: Profile streamer
- `streams`: Thông tin stream
- `viewer_profiles`: Profile người xem
- `viewer_sessions`: Lịch sử phiên
- `alerts`: Cảnh báo
- `dashboards`: Cấu hình dashboard

## 8. API Endpoints chính

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/v1/auth/login` | POST | Đăng nhập |
| `/api/v1/streams` | GET/POST | Quản lý streams |
| `/api/v1/analytics/realtime/{id}` | GET | Metrics real-time |
| `/api/v1/analytics/historical` | POST | Metrics lịch sử |
| `/api/v1/viewers` | GET | Danh sách người xem |
| `/api/v1/alerts` | GET/POST/PATCH | Quản lý cảnh báo |
| `/api/v1/dashboards` | GET/POST | Quản lý dashboard |
| `/health` | GET | Health check |

## 9. Troubleshooting

### 9.1. Không kết nối được ClickHouse
```powershell
# Restart ClickHouse
docker-compose restart clickhouse

# Kiểm tra logs
docker-compose logs clickhouse
```

### 9.2. Flink không nhận job
```powershell
# Kiểm tra JobManager
curl http://localhost:8081/v1/jobs

# Deploy lại job
docker-compose restart flink-jobmanager flink-taskmanager
```

### 9.3. Kafka topics không tồn tại
```powershell
# Tạo topics
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic livestream-events --partitions 12 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic livestream-metrics --partitions 6 --replication-factor 1
```

## 10. Dọn dẹp

```powershell
# Dừng tất cả
docker-compose down

# Xóa tất cả data (cẩn thận!)
docker-compose down -v

# Xóa images không dùng
docker system prune -a
```

## 11. Tài liệu tham khảo

- [Apache Kafka](https://kafka.apache.org/)
- [Apache Flink](https://flink.apache.org/)
- [ClickHouse](https://clickhouse.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/)