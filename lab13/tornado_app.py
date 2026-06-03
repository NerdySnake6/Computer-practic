import tornado.ioloop
import tornado.web
import time

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.write({"Hello": "World"})

class SlowHandler(tornado.web.RequestHandler):
    def get(self):
        time.sleep(0.1)
        self.write({"message": "This was a slow request"})

class HighCpuHandler(tornado.web.RequestHandler):
    def get(self):
        def cpu_intensive_task():
            total = 0
            for i in range(10_000_000):
                total += i
            return total
        result = cpu_intensive_task()
        self.write({"message": f"CPU task completed with result: {result}"})

class DatabaseHandler(tornado.web.RequestHandler):
    def get(self):
        time.sleep(0.05)
        self.write({"message": "Database query completed"})

def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
        (r"/slow_endpoint", SlowHandler),
        (r"/high_cpu_endpoint", HighCpuHandler),
        (r"/database_endpoint", DatabaseHandler),
    ])

if __name__ == "__main__":
    app = make_app()
    app.listen(8000)
    print("Tornado запущен на порту 8000...")
    tornado.ioloop.IOLoop.current().start()
