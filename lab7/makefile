# Compiler and source file
CC=emcc
SOURCES=main.c

# Optimization and linker flags
LDFLAGS=-O3 -s ALLOW_MEMORY_GROWTH=1

# Default target
all:
	$(CC) $(SOURCES) -s WASM=1 -s ASSERTIONS=1 -s MODULARIZE=1 -s EXPORT_NAME="'BudgetPlanner'" \
	-s EXPORTED_FUNCTIONS='["_main","_showHelloMessage","_jsAddExpense","_jsDeleteExpense","_jsClearAllExpenses","_jsGetTotalExpenses","_jsSetBudgetLimit","_jsGetRemainingBudget","_jsGetExpenseCount","_jsGetCategoryCount","_jsExportCSV","_getExpenseJSON","_getCategoryTotalJSON","_freeMemory","_malloc","_free"]' \
	-s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "stringToUTF8", "UTF8ToString"]' \
	$(LDFLAGS) -o index.js

# Clean target
clean:
	rm -f index.js
	rm -f index.wasm
