/**
 * app.js - Скрипт связи WebAssembly (C) и веб-интерфейса (HTML)
 * 
 * Этот файл обрабатывает события кнопок и формы ввода, вызывает
 * экспортированные функции C и обновляет DOM дерево на основе данных из Wasm.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Получаем ссылки на элементы интерфейса
    const expenseForm = document.getElementById('expenseForm');
    const expenseDate = document.getElementById('expenseDate');
    const expenseCategory = document.getElementById('expenseCategory');
    const expenseAmount = document.getElementById('expenseAmount');
    const expenseDescription = document.getElementById('expenseDescription');
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn'); // Наша новая кнопка
    const expenseTableBody = document.getElementById('expenseTableBody');
    const noExpensesRow = document.getElementById('noExpensesRow');
    const totalExpensesElement = document.getElementById('totalExpenses');
    const budgetLimitInput = document.getElementById('budgetLimitInput');
    const setBudgetBtn = document.getElementById('setBudgetBtn');
    const budgetLimitElement = document.getElementById('budgetLimit');
    const remainingBudgetElement = document.getElementById('remainingBudget');
    const categoryTotalsElement = document.getElementById('categoryTotals');
    const noCategoriesMessage = document.getElementById('noCategoriesMessage');
    const messageArea = document.getElementById('messageArea');
    
    // Устанавливаем текущую дату по умолчанию
    const today = new Date();
    const formattedDate = today.toISOString().substr(0, 10);
    expenseDate.value = formattedDate;
    
    // Показать всплывающее сообщение (успех или ошибка)
    function showMessage(message, type) {
        messageArea.textContent = message;
        messageArea.className = type === 'error' ? 'error-message' : 'success-message';
        messageArea.classList.remove('hidden');
        
        setTimeout(function() {
            messageArea.classList.add('hidden');
        }, 3000);
    }
    
    // Форматирование валюты
    function formatCurrency(amount) {
        return '$' + amount.toFixed(2);
    }
    
    // Добавление нового расхода
    function handleAddExpense(event) {
        event.preventDefault();
        
        const date = expenseDate.value;
        const category = expenseCategory.value;
        const amountStr = expenseAmount.value;
        const description = expenseDescription.value;
        
        if (!date || !category || !amountStr || !description) {
            showMessage('Пожалуйста, заполните все поля', 'error');
            return;
        }
        
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            showMessage('Введите корректную сумму', 'error');
            return;
        }
        
        // Выделяем память в Wasm для передачи строк в C
        const datePtr = Module._malloc(date.length + 1);
        const categoryPtr = Module._malloc(category.length + 1);
        const descriptionPtr = Module._malloc(description.length + 1);
        
        // Записываем JS-строки в выделенную Wasm память
        Module.stringToUTF8(date, datePtr, date.length + 1);
        Module.stringToUTF8(category, categoryPtr, category.length + 1);
        Module.stringToUTF8(description, descriptionPtr, description.length + 1);
        
        // Вызываем функцию C
        const result = Module._jsAddExpense(datePtr, categoryPtr, amount, descriptionPtr);
        
        // Освобождаем выделенную память
        Module._free(datePtr);
        Module._free(categoryPtr);
        Module._free(descriptionPtr);
        
        if (result === 1) {
            showMessage('Расход успешно добавлен', 'success');
            
            // Сбрасываем форму
            expenseCategory.value = '';
            expenseAmount.value = '';
            expenseDescription.value = '';
            expenseCategory.focus();
        } else {
            showMessage('Не удалось добавить расход. Достигнут лимит записей.', 'error');
        }
    }
    
    // Удаление расхода по индексу
    function handleDeleteExpense(index) {
        const result = Module._jsDeleteExpense(index);
        if (result === 1) {
            showMessage('Расход удален', 'success');
        } else {
            showMessage('Ошибка удаления расхода', 'error');
        }
    }
    
    // Очистка всех расходов
    function handleClearAllExpenses() {
        if (confirm('Вы уверены, что хотите удалить все расходы?')) {
            const result = Module._jsClearAllExpenses();
            if (result === 1) {
                showMessage('Все расходы удалены', 'success');
            } else {
                showMessage('Ошибка при очистке расходов', 'error');
            }
        }
    }

    // Установка лимита бюджета
    function handleSetBudgetLimit() {
        const amount = budgetLimitInput.value === '' ? 0 : parseFloat(budgetLimitInput.value);

        if (isNaN(amount) || amount < 0) {
            showMessage('Введите корректный положительный лимит', 'error');
            return;
        }

        const result = Module._jsSetBudgetLimit(amount);

        if (result === 1) {
            showMessage(amount === 0 ? 'Лимит бюджета сброшен' : 'Лимит бюджета обновлен', 'success');
            return;
        }

        showMessage('Ошибка при обновлении лимита', 'error');
    }

    // Функция улучшения: Экспорт в CSV с использованием WebAssembly
    function handleExportCSV() {
        // Вызываем C функцию, которая собирает и возвращает указатель на CSV-строку
        const csvPtr = Module._jsExportCSV();
        if (csvPtr === 0) {
            showMessage('Не удалось сгенерировать CSV', 'error');
            return;
        }
        
        // Преобразуем указатель на C-строку в JavaScript строку
        const csvContent = Module.UTF8ToString(csvPtr);
        
        // Освобождаем память в Wasm, которую выделил C-код
        Module._freeMemory(csvPtr);
        
        // Создаем файл для скачивания в браузере
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'expenses.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showMessage('Файл CSV успешно экспортирован', 'success');
    }
    
    // Функция обновления таблицы (вызывается из C через EM_ASM)
    window.updateExpenseTable = function() {
        const expenseCount = Module._jsGetExpenseCount();
        expenseTableBody.innerHTML = '';
        
        if (expenseCount === 0) {
            expenseTableBody.appendChild(noExpensesRow);
            return;
        }
        
        for (let i = 0; i < expenseCount; i++) {
            const expenseJsonPtr = Module._getExpenseJSON(i);
            if (expenseJsonPtr === 0) continue;
            
            const expenseJson = Module.UTF8ToString(expenseJsonPtr);
            const expense = JSON.parse(expenseJson);
            Module._freeMemory(expenseJsonPtr);
            
            const row = document.createElement('tr');
            
            const dateCell = document.createElement('td');
            dateCell.textContent = expense.date;
            row.appendChild(dateCell);
            
            const categoryCell = document.createElement('td');
            categoryCell.textContent = expense.category;
            row.appendChild(categoryCell);
            
            const amountCell = document.createElement('td');
            amountCell.textContent = formatCurrency(expense.amount);
            row.appendChild(amountCell);
            
            const descriptionCell = document.createElement('td');
            descriptionCell.textContent = expense.description;
            row.appendChild(descriptionCell);
            
            const actionCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Удалить';
            deleteButton.className = 'delete';
            deleteButton.onclick = function() {
                handleDeleteExpense(i);
            };
            actionCell.appendChild(deleteButton);
            row.appendChild(actionCell);
            
            expenseTableBody.appendChild(row);
        }
    };
    
    // Обновить общую сумму (вызывается из C)
    window.updateTotalExpenses = function(total) {
        totalExpensesElement.textContent = formatCurrency(total);
    };
 
    // Обновить сводку бюджета (вызывается из C)
    window.updateBudgetSummary = function(budgetLimit, remainingBudget) {
        if (budgetLimit <= 0) {
            budgetLimitElement.textContent = 'Не установлен';
            remainingBudgetElement.textContent = 'Не установлен';
            remainingBudgetElement.classList.remove('over-budget');
            return;
        }
 
        budgetLimitElement.textContent = formatCurrency(budgetLimit);
        remainingBudgetElement.textContent = formatCurrency(remainingBudget);
        remainingBudgetElement.classList.toggle('over-budget', remainingBudget < 0);
    };
    
    // Обновить сводку по категориям (вызывается из C)
    window.updateCategoryTotals = function() {
        const categoryCount = Module._jsGetCategoryCount();
        categoryTotalsElement.innerHTML = '';
        
        if (categoryCount === 0) {
            categoryTotalsElement.appendChild(noCategoriesMessage);
            return;
        }
        
        for (let i = 0; i < categoryCount; i++) {
            const categoryJsonPtr = Module._getCategoryTotalJSON(i);
            if (categoryJsonPtr === 0) continue;
            
            const categoryJson = Module.UTF8ToString(categoryJsonPtr);
            const category = JSON.parse(categoryJson);
            Module._freeMemory(categoryJsonPtr);
            
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-total-item';
            categoryElement.textContent = `${category.name}: ${formatCurrency(category.total)}`;
            
            categoryTotalsElement.appendChild(categoryElement);
        }
    };
    
    // Навешиваем обработчики событий
    expenseForm.addEventListener('submit', handleAddExpense);
    clearAllBtn.addEventListener('click', handleClearAllExpenses);
    setBudgetBtn.addEventListener('click', handleSetBudgetLimit);
    exportCsvBtn.addEventListener('click', handleExportCSV); // Добавляем клик экспорта
});
