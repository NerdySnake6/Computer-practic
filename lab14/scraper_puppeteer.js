const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Базовый URL
const BASE_URL = 'https://atlas.herzen.spb.ru/';
// Путь к выходному файлу CSV
const CSV_FILE = path.join(__dirname, 'teachers_puppeteer.csv');

// Вспомогательная функция для форматирования значений под стандарт CSV
function escapeCSV(str) {
    if (!str) return '""';
    // Экранируем двойные кавычки удвоением и оборачиваем в кавычки
    return `"${str.replace(/"/g, '""')}"`;
}

// Функция парсинга одного профиля преподавателя
async function scrapeProfile(browser, teacher) {
    let page;
    try {
        page = await browser.newPage();
        
        // Отключаем загрузку картинок, CSS и шрифтов для ускорения работы
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (type === 'image' || type === 'stylesheet' || type === 'font' || type === 'media') {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Переходим на страницу профиля
        await page.goto(teacher.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Извлекаем контакты со страницы
        const contacts = await page.evaluate(() => {
            const h1s = Array.from(document.querySelectorAll('h1.text-m'));
            let email = '';
            let phone = '';

            h1s.forEach(h1 => {
                const text = h1.textContent.trim();
                if (text.includes('@')) {
                    email = text;
                } else if (text.split('').some(c => c >= '0' && c <= '9') && (text.includes('+') || text.includes('-') || text.includes('('))) {
                    phone = text;
                }
            });

            return { email, phone };
        });

        teacher.email = contacts.email;
        teacher.phone = contacts.phone;
    } catch (err) {
        console.error(`Ошибка при сборе контактов из профиля ${teacher.url}: ${err.message}`);
        teacher.email = '';
        teacher.phone = '';
    } finally {
        if (page) {
            await page.close();
        }
    }
}

async function main() {
    console.log('Начало работы скрапера (Puppeteer)...');
    const startTime = Date.now();

    // Запускаем headless браузер
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const teachers = [];

    try {
        // 1. Парсим список преподавателей со страниц 1 по 54
        console.log('Сбор ссылок на профили преподавателей...');
        const concurrencyPages = 5;
        for (let p = 1; p <= 54; p += concurrencyPages) {
            const pagePromises = [];
            for (let j = 0; j < concurrencyPages && (p + j) <= 54; j++) {
                const pageNum = p + j;
                pagePromises.push((async () => {
                    let listPage;
                    try {
                        listPage = await browser.newPage();
                        // Отключаем лишние ресурсы
                        await listPage.setRequestInterception(true);
                        listPage.on('request', (req) => {
                            const type = req.resourceType();
                            if (type === 'image' || type === 'stylesheet' || type === 'font') {
                                req.abort();
                            } else {
                                req.continue();
                            }
                        });

                        await listPage.goto(`https://atlas.herzen.spb.ru/teachers?page=${pageNum}`, {
                            waitUntil: 'domcontentloaded',
                            timeout: 25000
                        });

                        const pageTeachers = await listPage.evaluate(() => {
                            const rows = Array.from(document.querySelectorAll('table tbody tr'));
                            return rows.map(row => {
                                const linkEl = row.querySelector('td a');
                                if (linkEl && linkEl.href.includes('teachers/')) {
                                    return {
                                        name: linkEl.textContent.trim(),
                                        url: linkEl.href
                                    };
                                }
                                return null;
                            }).filter(item => item !== null);
                        });

                        teachers.push(...pageTeachers);
                        console.log(`Спарсена страница списка: ${pageNum}/54`);
                    } catch (err) {
                        console.error(`Ошибка парсинга списка на странице ${pageNum}: ${err.message}`);
                    } finally {
                        if (listPage) {
                            await listPage.close();
                        }
                    }
                })());
            }
            await Promise.all(pagePromises);
        }

        console.log(`Всего найдено преподавателей: ${teachers.length}`);
        console.log('Начало обхода профилей...');

        // 2. Обходим профили пачками по 15 штук
        const concurrencyProfiles = 15;
        for (let i = 0; i < teachers.length; i += concurrencyProfiles) {
            const batch = teachers.slice(i, i + concurrencyProfiles);
            await Promise.all(batch.map(teacher => scrapeProfile(browser, teacher)));
            console.log(`Обработано профилей: ${Math.min(i + concurrencyProfiles, teachers.length)} / ${teachers.length}`);
        }

        // 3. Запись результатов в CSV-файл
        console.log('Запись собранных данных в CSV-файл...');
        const header = 'ФИО,Ссылка,Почта,Телефон\n';
        fs.writeFileSync(CSV_FILE, header, 'utf8');

        for (const teacher of teachers) {
            const line = `${escapeCSV(teacher.name)},${escapeCSV(teacher.url)},${escapeCSV(teacher.email || '')},${escapeCSV(teacher.phone || '')}\n`;
            fs.appendFileSync(CSV_FILE, line, 'utf8');
        }

        const endTime = Date.now();
        console.log('Сбор данных успешно завершен!');
        console.log(`Файл сохранен: ${CSV_FILE}`);
        console.log(`Затраченное время: ${Math.round((endTime - startTime) / 1000)} сек.`);

    } catch (err) {
        console.error(`Критическая ошибка: ${err.message}`);
    } finally {
        await browser.close();
    }
}

main();
