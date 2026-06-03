/**
 * main.c - Планировщик бюджета и расходов на WebAssembly
 * 
 * В этом файле реализована логика трекера расходов на языке C.
 * Код компилируется в WebAssembly с помощью Emscripten и связывается с HTML/JS.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>

// Максимальное количество расходов, которое можем сохранить
#define MAX_EXPENSES 100

// Максимальная длина текстовых полей
#define MAX_STRING_LENGTH 100

// Максимальное количество уникальных категорий
#define MAX_CATEGORIES 10

// Объявления функций
void updateCategoryTotals();
void updateUI();

// Структура для одного расхода
typedef struct {
    char date[MAX_STRING_LENGTH];        // Дата расхода (храним как строку для простоты)
    char category[MAX_STRING_LENGTH];    // Категория (например, "Еда", "Транспорт")
    double amount;                       // Сумма расхода
    char description[MAX_STRING_LENGTH]; // Описание расхода
} ExpenseEntry;

// Структура для итогов по категориям
typedef struct {
    char name[MAX_STRING_LENGTH];        // Имя категории
    double total;                        // Общая сумма расходов в ней
} CategoryTotal;

// Глобальный массив всех расходов
ExpenseEntry expenses[MAX_EXPENSES];

// Глобальный массив итогов по категориям
CategoryTotal categoryTotals[MAX_CATEGORIES];

// Текущее количество расходов
int expenseCount = 0;

// Текущее количество категорий
int categoryCount = 0;

// Ограничение бюджета (0.0 означает, что лимит не установлен)
double budgetLimit = 0.0;

// Функция добавления нового расхода
int addExpense(const char* date, const char* category, double amount, const char* description) {
    if (expenseCount >= MAX_EXPENSES) {
        return 0; // Массив переполнен
    }
    
    ExpenseEntry* newExpense = &expenses[expenseCount];
    
    strncpy(newExpense->date, date, MAX_STRING_LENGTH - 1);
    newExpense->date[MAX_STRING_LENGTH - 1] = '\0';
    
    strncpy(newExpense->category, category, MAX_STRING_LENGTH - 1);
    newExpense->category[MAX_STRING_LENGTH - 1] = '\0';
    
    newExpense->amount = amount;
    
    strncpy(newExpense->description, description, MAX_STRING_LENGTH - 1);
    newExpense->description[MAX_STRING_LENGTH - 1] = '\0';
    
    expenseCount++;
    
    updateCategoryTotals();
    updateUI();
    
    return 1;
}

// Функция удаления расхода по его индексу
int deleteExpense(int index) {
    if (index < 0 || index >= expenseCount) {
        return 0; // Некорректный индекс
    }
    
    // Сдвигаем элементы влево
    for (int i = index; i < expenseCount - 1; i++) {
        expenses[i] = expenses[i + 1];
    }
    
    expenseCount--;
    
    updateCategoryTotals();
    updateUI();
    
    return 1;
}

// Очистить все расходы
int clearAllExpenses() {
    expenseCount = 0;
    categoryCount = 0;
    updateUI();
    return 1;
}

// Подсчитать общую сумму расходов
double calculateTotalExpenses() {
    double total = 0.0;
    for (int i = 0; i < expenseCount; i++) {
        total += expenses[i].amount;
    }
    return total;
}

// Установить лимит бюджета
int setBudgetLimit(double amount) {
    if (amount < 0.0) {
        return 0;
    }
    budgetLimit = amount;
    updateUI();
    return 1;
}

// Рассчитать остаток бюджета
double calculateRemainingBudget() {
    return budgetLimit - calculateTotalExpenses();
}

// Пересчитать итоги по категориям
void updateCategoryTotals() {
    categoryCount = 0;
    
    for (int i = 0; i < MAX_CATEGORIES; i++) {
        categoryTotals[i].name[0] = '\0';
        categoryTotals[i].total = 0.0;
    }
    
    for (int i = 0; i < expenseCount; i++) {
        const char* category = expenses[i].category;
        double amount = expenses[i].amount;
        
        int categoryIndex = -1;
        for (int j = 0; j < categoryCount; j++) {
            if (strcmp(categoryTotals[j].name, category) == 0) {
                categoryIndex = j;
                break;
            }
        }
        
        if (categoryIndex == -1) {
            if (categoryCount >= MAX_CATEGORIES) {
                continue; // Превышен лимит категорий
            }
            
            categoryIndex = categoryCount;
            strncpy(categoryTotals[categoryIndex].name, category, MAX_STRING_LENGTH - 1);
            categoryTotals[categoryIndex].name[MAX_STRING_LENGTH - 1] = '\0';
            categoryTotals[categoryIndex].total = 0.0;
            categoryCount++;
        }
        
        categoryTotals[categoryIndex].total += amount;
    }
}

int getExpenseCount() {
    return expenseCount;
}

int getCategoryCount() {
    return categoryCount;
}

// Получить один расход в формате JSON (возвращает указатель на выделенную память)
char* EMSCRIPTEN_KEEPALIVE getExpenseJSON(int index) {
    if (index < 0 || index >= expenseCount) {
        return NULL;
    }
    
    ExpenseEntry* expense = &expenses[index];
    
    char* json = (char*)malloc(MAX_STRING_LENGTH * 4);
    if (json == NULL) {
        return NULL;
    }
    
    sprintf(json, "{\"date\":\"%s\",\"category\":\"%s\",\"amount\":%.2f,\"description\":\"%s\"}",
            expense->date, expense->category, expense->amount, expense->description);
    
    return json;
}

// Получить итог по категории в формате JSON
char* EMSCRIPTEN_KEEPALIVE getCategoryTotalJSON(int index) {
    if (index < 0 || index >= categoryCount) {
        return NULL;
    }
    
    CategoryTotal* category = &categoryTotals[index];
    
    char* json = (char*)malloc(MAX_STRING_LENGTH * 2);
    if (json == NULL) {
        return NULL;
    }
    
    sprintf(json, "{\"name\":\"%s\",\"total\":%.2f}", category->name, category->total);
    
    return json;
}

// Освободить память, выделенную C-кодом
void EMSCRIPTEN_KEEPALIVE freeMemory(char* ptr) {
    free(ptr);
}

// Функция обновления интерфейса через JS-коллбеки
void updateUI() {
    EM_ASM({
        updateExpenseTable();
    });
    
    double total = calculateTotalExpenses();
    EM_ASM({
        updateTotalExpenses($0);
    }, total);

    EM_ASM({
        updateBudgetSummary($0, $1);
    }, budgetLimit, calculateRemainingBudget());
    
    EM_ASM({
        updateCategoryTotals();
    });
}

// Экспортируемые функции для JS
int EMSCRIPTEN_KEEPALIVE jsAddExpense(const char* date, const char* category, double amount, const char* description) {
    return addExpense(date, category, amount, description);
}

int EMSCRIPTEN_KEEPALIVE jsDeleteExpense(int index) {
    return deleteExpense(index);
}

int EMSCRIPTEN_KEEPALIVE jsClearAllExpenses() {
    return clearAllExpenses();
}

double EMSCRIPTEN_KEEPALIVE jsGetTotalExpenses() {
    return calculateTotalExpenses();
}

int EMSCRIPTEN_KEEPALIVE jsSetBudgetLimit(double amount) {
    return setBudgetLimit(amount);
}

double EMSCRIPTEN_KEEPALIVE jsGetRemainingBudget() {
    return calculateRemainingBudget();
}

int EMSCRIPTEN_KEEPALIVE jsGetExpenseCount() {
    return getExpenseCount();
}

int EMSCRIPTEN_KEEPALIVE jsGetCategoryCount() {
    return getCategoryCount();
}

// Функция улучшения: Экспорт всех расходов в формат CSV
char* EMSCRIPTEN_KEEPALIVE jsExportCSV() {
    // Выделяем память под всю CSV строку
    int size = MAX_EXPENSES * 300 + 100;
    char* csv = (char*)malloc(size);
    if (csv == NULL) {
        return NULL;
    }
    
    // Записываем заголовок
    strcpy(csv, "Date,Category,Amount,Description\n");
    
    // Добавляем каждую строку расхода
    for (int i = 0; i < expenseCount; i++) {
        char line[400];
        // Форматируем строку CSV
        sprintf(line, "%s,%s,%.2f,%s\n", 
                expenses[i].date, 
                expenses[i].category, 
                expenses[i].amount, 
                expenses[i].description);
        strcat(csv, line);
    }
    
    return csv;
}

void EMSCRIPTEN_KEEPALIVE showHelloMessage() {
    EM_ASM({
        alert("Привет из C!");
    });
}

int main() {
    printf("Приложение планировщика бюджета WebAssembly запущено\n");
    expenseCount = 0;
    categoryCount = 0;
    budgetLimit = 0.0;
    updateUI();
    return 0;
}
