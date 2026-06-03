from flask import Flask, jsonify
import time

app = Flask(__name__)

@app.route("/")
def read_root():
    return jsonify({"Hello": "World"})

@app.route("/slow_endpoint")
def slow_endpoint():
    time.sleep(0.1)
    return jsonify({"message": "This was a slow request"})

@app.route("/high_cpu_endpoint")
def high_cpu_endpoint():
    def cpu_intensive_task():
        total = 0
        for i in range(10_000_000):
            total += i
        return total
    result = cpu_intensive_task()
    return jsonify({"message": f"CPU task completed with result: {result}"})

@app.route("/database_endpoint")
def database_endpoint():
    time.sleep(0.05)
    return jsonify({"message": "Database query completed"})

if __name__ == "__main__":
    app.run(port=8000)
