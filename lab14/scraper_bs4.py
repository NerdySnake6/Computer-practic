import requests
from bs4 import BeautifulSoup
import csv
import time
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

# Базовый URL сайта
BASE_URL = "https://atlas.herzen.spb.ru/"
# Список преподавателей
TEACHERS_LIST_URL = "https://atlas.herzen.spb.ru/teachers?page="

# Функция для загрузки и парсинга контактов с конкретной страницы профиля
def parse_profile(name, profile_url):
    try:
        # Загружаем страницу профиля преподавателя
        response = requests.get(profile_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        if response.status_code != 200:
            return {"ФИО": name, "Ссылка": profile_url, "Почта": "", "Телефон": ""}
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        emails = []
        phones = []
        
        # Находим все элементы h1 с классом text-m (в них хранятся контакты)
        for h1 in soup.find_all('h1', class_='text-m'):
            text = h1.text.strip()
            if '@' in text:
                emails.append(text)
            elif any(c.isdigit() for c in text) and ('+' in text or '-' in text or '(' in text):
                phones.append(text)
        
        # Объединяем, если найдено несколько
        email = ", ".join(emails) if emails else ""
        phone = ", ".join(phones) if phones else ""
        
        return {
            "ФИО": name,
            "Ссылка": profile_url,
            "Почта": email,
            "Телефон": phone
        }
    except Exception as e:
        print(f"Ошибка при загрузке профиля {profile_url}: {e}")
        return {"ФИО": name, "Ссылка": profile_url, "Почта": "", "Телефон": ""}

def main():
    print("Начало сбора данных преподавателей (BeautifulSoup)...")
    start_time = time.time()
    
    teachers_to_scrape = []
    
    # 1. Собираем ФИО и ссылки со страниц 1 по 54
    for page in range(1, 55):
        url = f"{TEACHERS_LIST_URL}{page}"
        print(f"Парсинг страницы со списком {page}/54...")
        try:
            response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            if response.status_code != 200:
                print(f"Не удалось загрузить страницу {page}")
                continue
            
            soup = BeautifulSoup(response.content, 'html.parser')
            table = soup.find('table')
            if not table:
                print(f"Таблица не найдена на странице {page}")
                continue
                
            rows = table.find_all('tr')[1:] # Пропускаем заголовок
            for row in rows:
                cols = row.find_all('td')
                if not cols:
                    continue
                link_el = cols[0].find('a')
                if link_el:
                    name = link_el.text.strip()
                    profile_url = urljoin(BASE_URL, link_el['href'])
                    teachers_to_scrape.append((name, profile_url))
        except Exception as e:
            print(f"Ошибка при парсинге списка на странице {page}: {e}")
            
    total_teachers = len(teachers_to_scrape)
    print(f"Всего найдено преподавателей: {total_teachers}")
    
    # 2. Обходим профили параллельно для ускорения процесса
    results = []
    processed_count = 0
    
    print("Начало загрузки контактных данных профилей...")
    # Используем 15 потоков для ускорения работы скрапера
    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(parse_profile, name, url): (name, url) for name, url in teachers_to_scrape}
        
        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            processed_count += 1
            if processed_count % 100 == 0 or processed_count == total_teachers:
                print(f"Обработано профилей: {processed_count}/{total_teachers}")
                
    # 3. Запись данных в CSV
    csv_file = "teachers_bs4.csv"
    with open(csv_file, mode="w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["ФИО", "Ссылка", "Почта", "Телефон"])
        writer.writeheader()
        writer.writerows(results)
        
    end_time = time.time()
    print(f"Сбор данных успешно завершен!")
    print(f"Данные сохранены в файл: {csv_file}")
    print(f"Затрачено времени: {round(end_time - start_time, 2)} сек.")

if __name__ == "__main__":
    main()
