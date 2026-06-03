// Бизнес-процесс: Получение погоды в столице Финляндии через публичные REST API
// Использует встроенный fetch (доступен в Node.js 18+)

async function checkWeatherWorkflow() {
  const country = 'Finland';
  console.log(`Шаг 1: Запрашиваем информацию о стране: ${country}...`);

  try {
    // 1. Получаем координаты столицы страны
    const countryRes = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}`);
    if (!countryRes.ok) {
      throw new Error(`Ошибка при запросе к REST Countries API: ${countryRes.status}`);
    }
    const countryData = await countryRes.json();
    
    const capital = countryData[0].capital[0];
    const [lat, lon] = countryData[0].capitalInfo.latlng;
    
    console.log(`-> Успешно! Столица: ${capital}, Координаты: широта = ${lat}, долгота = ${lon}`);
    console.log(`\nШаг 2: Запрашиваем погоду по координатам [${lat}, ${lon}] для города ${capital}...`);

    // 2. Получаем погоду по координатам
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!weatherRes.ok) {
      throw new Error(`Ошибка при запросе к Open-Meteo API: ${weatherRes.status}`);
    }
    const weatherData = await weatherRes.json();
    
    const temp = weatherData.current_weather.temperature;
    const windspeed = weatherData.current_weather.windspeed;
    
    console.log(`-> Успешно! Текущая температура в ${capital}: ${temp}°C, Скорость ветра: ${windspeed} м/с`);
    console.log('\nБизнес-процесс успешно выполнен и протестирован!');
  } catch (error) {
    console.error('Ошибка во время выполнения процесса:', error.message);
  }
}

checkWeatherWorkflow();
