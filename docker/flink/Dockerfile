FROM flink:1.17-scala_2.12-java11

# Install Python dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python3 -m venv /opt/flink/venv
ENV PATH="/opt/flink/venv/bin:$PATH"

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy requirements and install
COPY requirements.txt /opt/flink/requirements.txt
RUN pip install --no-cache-dir -r /opt/flink/requirements.txt

# Copy job code
COPY flink_job.py /opt/flink/usrlib/flink_job.py

# Set working directory
WORKDIR /opt/flink

# Default command (can be overridden)
CMD ["python", "/opt/flink/usrlib/flink_job.py"]