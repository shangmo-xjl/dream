// Angular应用
var app = angular.module('notebookApp', []);

app.controller('NotebookController', function($scope, $interval) {
    // 初始化数据
    $scope.records = [];
    $scope.totalAmount = '0.00';
    $scope.showAllRecords = false;

    // 更新时间
    function updateTime() {
        var now = new Date();
        var options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        $scope.currentTime = now.toLocaleDateString('zh-CN', options);
    }

    // 每秒更新时间
    updateTime();
    $interval(updateTime, 1000);

    // 添加记录
    $scope.addRecord = function() {
        var now = new Date();
        var dateStr = now.getFullYear() + '/' +
                     ('0' + (now.getMonth() + 1)).slice(-2) + '/' +
                     ('0' + now.getDate()).slice(-2) + ' ' +
                     ('0' + now.getHours()).slice(-2) + ':' +
                     ('0' + now.getMinutes()).slice(-2) + ':' +
                     ('0' + now.getSeconds()).slice(-2);

        $scope.records.unshift({
            date: dateStr,
            event: '',
            amount: '',
            showPlaceholderEvent: true,
            showPlaceholderAmount: true
        });
    };

    // 切换显示更多
    $scope.toggleShowMore = function() {
        $scope.showAllRecords = true;
    };

    // 计算总金额
    $scope.calculateTotal = function() {
        var total = 0;
        for (var i = 0; i < $scope.records.length; i++) {
            var amount = parseFloat($scope.records[i].amount) || 0;
            total += amount;
        }
        $scope.totalAmount = total.toFixed(2);
    };

    // 添加第一条记录
    $scope.addRecord();

    // 删除记录
    $scope.deleteRecord = function(index) {
        $scope.records.splice(index, 1);
        $scope.calculateTotal();
    };

    // 初始化数据库
    var db;
    var dbName = "expenseDB";
    var dbVersion = 1;

    // 打开数据库连接
    var request = indexedDB.open(dbName, dbVersion);

    request.onerror = function(event) {
        console.error("数据库错误: " + event.target.error);
        alert("数据库访问失败，请确保您的浏览器支持 IndexedDB");
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("数据库连接成功");
        // 加载最近的记录
        loadTodayRecords();
    };

    request.onupgradeneeded = function(event) {
        var db = event.target.result;

        // 创建记录存储对象
        if (!db.objectStoreNames.contains('records')) {
            var objectStore = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
            // 创建索引
            objectStore.createIndex('date', 'date', { unique: false });
            objectStore.createIndex('dateStr', 'dateStr', { unique: false });
        }
    };

    $scope.saveRecords = function() {
        if (!db) {
            alert("数据库未就绪，请稍后重试");
            return;
        }

        // 新增：校验事件内容和花费金额是否为空
        var hasEmptyFields = $scope.records.some(function(record) {
            return !record.event || !record.amount;
        });

        if (hasEmptyFields) {
            alert("事件内容和花费金额不能为空，请检查后重新保存！");
            return; // 终止保存操作
        }

        var now = new Date();
        var dateStr = now.getFullYear() + '-' +
                 ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
                 ('0' + now.getDate()).slice(-2);

        var transaction = db.transaction(['records'], 'readwrite');
        var objectStore = transaction.objectStore('records');

        $scope.records.forEach(function(record) {
            var recordToSave = {
                date: new Date(record.date),
                dateStr: dateStr,
                event: record.event,
                amount: record.amount
            };

            objectStore.add(recordToSave);
        });

        transaction.oncomplete = function() {
            alert('记录已成功保存！');
            window.location.reload(); // 页面重新加载
        };

        transaction.onerror = function(event) {
            alert('保存失败：' + event.target.error);
        };
    };

    // 查看历史记录
    $scope.viewHistory = function() {
        if (!db) {
            alert("数据库未就绪，请稍后重试");
            return;
        }

        var transaction = db.transaction(['records'], 'readonly');
        var objectStore = transaction.objectStore('records');
        var request = objectStore.getAll();

        request.onerror = function(event) {
            alert('获取历史记录失败: ' + event.target.error);
        };

        request.onsuccess = function(event) {
            var allRecords = event.target.result;
            window.allDbRecords = allRecords;

            // 显示历史记录容器和回退按钮
            var historyContainer = document.getElementById('historyContainer');
            var backBtn = document.getElementById('backBtn');

            historyContainer.classList.add('active');
            backBtn.classList.add('active');

            // 强制更新按钮样式
            backBtn.style.display = 'flex';
            backBtn.style.visibility = 'visible';
            backBtn.style.opacity = '1';

            // 初始化年份选择器
            var yearSelect = document.getElementById('yearSelect');
            yearSelect.innerHTML = ''; // 清空现有选项
            var years = new Set();
            allRecords.forEach(function(record) {
                try {
                    var recordDate = new Date(record.date);
                    if (!isNaN(recordDate.getTime())) {
                        years.add(recordDate.getFullYear());
                    }
                } catch(e) {
                    console.warn("Could not parse year for record:", record, e);
                }
            });

            var sortedYears = Array.from(years).sort((a, b) => b - a); // 降序排列
            if (sortedYears.length === 0) {
                var defaultOption = document.createElement('option');
                defaultOption.textContent = '无记录';
                defaultOption.disabled = true;
                yearSelect.appendChild(defaultOption);
            } else {
                sortedYears.forEach(function(year) {
                    var option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    yearSelect.appendChild(option);
                });
                // 初始计算最新年份的数据
                calculateAndDisplayMonthlyTotals();
            }

            // 显示记录
            filterAndDisplayHistory();

            // 设置默认结束日期为今天
            try {
                var today = new Date().toISOString().split('T')[0];
                document.getElementById('endDate').value = today;
            } catch (e) {
                console.error("Error setting default date: ", e);
            }
        };
    };

    // 返回主页面
    $scope.backToMain = function() {
        document.getElementById('historyContainer').classList.remove('active');
        document.getElementById('backBtn').classList.remove('active');
    };

    // 显示记录函数
    function displayRecords(recordsToDisplay) {
        var container = document.getElementById("recordListContainer");
        container.innerHTML = ""; // 清空之前的结果
        
        if (!recordsToDisplay || recordsToDisplay.length === 0) {
            container.innerHTML = '<div class="no-results">没有找到匹配的记录。</div>';
            return;
        }

        // 按年份和月份分组
        var groupedByYear = {};
        recordsToDisplay.forEach(function(record) {
            var date = new Date(record.date);
            var year = date.getFullYear();
            var month = date.getMonth() + 1;
            var day = date.getDate();
            
            if (!groupedByYear[year]) {
                groupedByYear[year] = {};
            }
            if (!groupedByYear[year][month]) {
                groupedByYear[year][month] = {};
            }
            if (!groupedByYear[year][month][day]) {
                groupedByYear[year][month][day] = [];
            }
            groupedByYear[year][month][day].push(record);
        });

        // 创建年份折叠面板
        Object.keys(groupedByYear).sort((a, b) => b - a).forEach(function(year, yearIndex) {
            var yearTotal = 0;
            var yearAccordionItem = document.createElement('div');
            yearAccordionItem.className = 'accordion-item year-item';
            
            // 计算年度总额
            Object.values(groupedByYear[year]).forEach(function(monthData) {
                Object.values(monthData).forEach(function(dayData) {
                    dayData.forEach(function(record) {
                        yearTotal += parseFloat(record.amount) || 0;
                    });
                });
            });

            // 年份标题
            var yearHeader = `
                <h2 class="accordion-header" id="yearHeading${yearIndex}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                            data-bs-target="#yearCollapse${yearIndex}" aria-expanded="false">
                        ${year}年 (总计: ¥${yearTotal.toFixed(2)})
                    </button>
                </h2>
            `;

            // 年份内容容器
            var yearContent = document.createElement('div');
            yearContent.id = `yearCollapse${yearIndex}`;
            yearContent.className = 'accordion-collapse collapse';
            yearContent.setAttribute('data-bs-parent', '#recordListContainer');

            var yearBody = document.createElement('div');
            yearBody.className = 'accordion-body';
            var monthAccordion = document.createElement('div');
            monthAccordion.className = 'accordion';
            monthAccordion.id = `monthAccordion${year}`;

            // 处理月份
            Object.keys(groupedByYear[year]).sort((a, b) => b - a).forEach(function(month, monthIndex) {
                var monthTotal = 0;
                var monthId = `${year}_${month}`;
                
                // 计算月度总额
                Object.values(groupedByYear[year][month]).forEach(function(dayData) {
                    dayData.forEach(function(record) {
                        monthTotal += parseFloat(record.amount) || 0;
                    });
                });

                // 月份容器
                var monthItem = document.createElement('div');
                monthItem.className = 'accordion-item month-item';
                monthItem.innerHTML = `
                    <h2 class="accordion-header" id="monthHeading${monthId}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                                data-bs-target="#monthCollapse${monthId}" aria-expanded="false">
                            ${month}月 (总计: ¥${monthTotal.toFixed(2)})
                        </button>
                    </h2>
                `;

                var monthContent = document.createElement('div');
                monthContent.id = `monthCollapse${monthId}`;
                monthContent.className = 'accordion-collapse collapse';
                monthContent.setAttribute('data-bs-parent', `#monthAccordion${year}`);

                var monthBody = document.createElement('div');
                monthBody.className = 'accordion-body';
                var dayAccordion = document.createElement('div');
                dayAccordion.className = 'accordion';
                dayAccordion.id = `dayAccordion${monthId}`;

                // 处理日期
                Object.keys(groupedByYear[year][month]).sort((a, b) => b - a).forEach(function(day, dayIndex) {
                    var dayTotal = 0;
                    var records = groupedByYear[year][month][day];
                    var dayId = `${year}_${month}_${day}`;

                    // 计算日总额
                    records.forEach(function(record) {
                        dayTotal += parseFloat(record.amount) || 0;
                    });

                    // 日期容器
                    var dayItem = document.createElement('div');
                    dayItem.className = 'accordion-item day-item';
                    dayItem.innerHTML = `
                        <h2 class="accordion-header" id="dayHeading${dayId}">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                                    data-bs-target="#dayCollapse${dayId}" aria-expanded="false">
                                ${day}日 (总计: ¥${dayTotal.toFixed(2)})
                            </button>
                        </h2>
                    `;

                    var dayContent = document.createElement('div');
                    dayContent.id = `dayCollapse${dayId}`;
                    dayContent.className = 'accordion-collapse collapse';
                    dayContent.setAttribute('data-bs-parent', `#dayAccordion${monthId}`);

                    var dayBody = document.createElement('div');
                    dayBody.className = 'accordion-body';

                    // 添加具体记录
                    records.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(function(record) {
                        var recordTime = new Date(record.date).toLocaleTimeString('zh-CN', 
                            { hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false });
                        var recordAmount = (parseFloat(record.amount) || 0).toFixed(2);
                        var recordEvent = record.event || '(无内容)';

                        var recordItemDiv = document.createElement('div');
                        recordItemDiv.className = 'record-item';
                        recordItemDiv.id = 'record-' + record.id;
                        recordItemDiv.innerHTML = `
                            <div class="record-details">
                                <div class="time">${recordTime}</div>
                                <div class="event">${recordEvent}</div>
                            </div>
                            <div class="amount">¥${recordAmount}</div>
                            <button class="btn btn-outline-danger btn-sm btn-delete-record">删除</button>
                        `;

                        recordItemDiv.querySelector('.btn-delete-record').onclick = function() {
                            deleteHistoryRecord(record.id);
                        };

                        dayBody.appendChild(recordItemDiv);
                    });

                    dayContent.appendChild(dayBody);
                    dayItem.appendChild(dayContent);
                    dayAccordion.appendChild(dayItem);
                });

                monthBody.appendChild(dayAccordion);
                monthContent.appendChild(monthBody);
                monthItem.appendChild(monthContent);
                monthAccordion.appendChild(monthItem);
            });

            yearBody.appendChild(monthAccordion);
            yearContent.appendChild(yearBody);
            yearAccordionItem.innerHTML = yearHeader;
            yearAccordionItem.appendChild(yearContent);
            container.appendChild(yearAccordionItem);
        });
    }

    // 筛选并显示历史记录
    window.filterAndDisplayHistory = function() {
        if (!window.allDbRecords) {
            console.error('找不到记录数据。');
            return;
        }
        var searchTerm = document.getElementById("searchInput").value.toLowerCase();
        var startDate = document.getElementById("startDate").value;
        var endDate = document.getElementById("endDate").value;

        var filteredRecords = window.allDbRecords.filter(function(record) {
            var recordDateStr = record.dateStr || new Date(record.date).toISOString().split('T')[0];
            var matchSearch = !searchTerm || (record.event && record.event.toLowerCase().includes(searchTerm));
            var matchStartDate = !startDate || recordDateStr >= startDate;
            var matchEndDate = !endDate || recordDateStr <= endDate;
            return matchSearch && matchStartDate && matchEndDate;
        });
        displayRecords(filteredRecords);
    }

    // 删除历史记录
    window.deleteHistoryRecord = function(id) {
        if (!confirm("确定要删除这条记录吗？")) return;

        var request = indexedDB.open(dbName, dbVersion);
        request.onerror = function(event) {
            alert("数据库访问失败: " + event.target.error);
        };
        request.onsuccess = function(event) {
            db = event.target.result;
            var transaction = db.transaction(["records"], "readwrite");
            var objectStore = transaction.objectStore("records");
            var deleteRequest = objectStore.delete(id);

            deleteRequest.onsuccess = function() {
                console.log("记录 " + id + " 已从数据库删除");
                if (window.allDbRecords) {
                    window.allDbRecords = window.allDbRecords.filter(function(record) {
                        return record.id !== id;
                    });
                    filterAndDisplayHistory();
                    recalculateTotalAmount(); // 重新计算总额
                    calculateAndDisplayMonthlyTotals(); // 新增：重新计算年度和月度总计
                    console.log("记录已在界面更新");
                } else {
                    console.error("找不到本地记录数组来更新UI。");
                }
            };
            deleteRequest.onerror = function(event) {
                alert("删除数据库记录失败: " + event.target.error);
            };
        };
    };

    // 新增：重新计算总额
    function recalculateTotalAmount() {
        var total = 0;
        if (window.allDbRecords) {
            window.allDbRecords.forEach(function(record) {
                var amount = parseFloat(record.amount) || 0;
                total += amount;
            });
        }
        document.querySelector('.total-amount').textContent = '金额: ¥' + total.toFixed(2);
    }

    // 计算并显示月度总计
    window.calculateAndDisplayMonthlyTotals = function() {
        var yearSelect = document.getElementById('yearSelect');
        var selectedYear = parseInt(yearSelect.value);
        var totalsList = document.getElementById('monthlyTotalsList');
        totalsList.innerHTML = '';

        if (isNaN(selectedYear) || !window.allDbRecords) {
            return;
        }

        var monthlyTotals = Array(12).fill(0);
        var yearTotal = 0;

        window.allDbRecords.forEach(function(record) {
            try {
                var recordDate = new Date(record.date);
                if (!isNaN(recordDate.getTime()) && recordDate.getFullYear() === selectedYear) {
                    var monthIndex = recordDate.getMonth();
                    var amount = parseFloat(record.amount) || 0;
                    monthlyTotals[monthIndex] += amount;
                    yearTotal += amount;
                }
            } catch (e) {
                console.warn("无法解析记录日期:", record, e);
            }
        });

        var yearTotalLi = document.createElement('li');
        yearTotalLi.style.fontWeight = 'bold';
        yearTotalLi.style.backgroundColor = '#cfe2ff';
        yearTotalLi.textContent = '年度总计 (' + selectedYear + ')';
        yearTotalLi.innerHTML += '<span>¥' + yearTotal.toFixed(2) + '</span>';
        totalsList.appendChild(yearTotalLi);

        monthlyTotals.forEach(function(total, index) {
            if (total > 0) {
                var month = index + 1;
                var li = document.createElement('li');
                li.textContent = month + '月';
                li.innerHTML += '<span>¥' + total.toFixed(2) + '</span>';
                totalsList.appendChild(li);
            }
        });

        if (totalsList.children.length <= 1) {
            var noDataLi = document.createElement('li');
            noDataLi.textContent = '该年份无消费记录';
            noDataLi.style.textAlign = 'center';
            noDataLi.style.color = '#6c757d';
            totalsList.appendChild(noDataLi);
        }
    }
});