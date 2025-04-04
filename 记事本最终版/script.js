// Angular应用
var app = angular.module('notebookApp', []);

app.controller('NotebookController', function($scope, $interval) {
    // 初始化数据
    $scope.records = [];
    $scope.totalAmount = '0.00';
    $scope.showAllRecords = false;

    // 滑动相关变量
    var startX = 0;
    var currentX = 0;
    var sliding = false;
    var slideThreshold = 50; // 触发滑动的阈值

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

    // 开始滑动
    $scope.startSlide = function(event, index) {
        startX = event.clientX;
        sliding = true;
        angular.element(event.currentTarget).addClass('sliding');
    };

    // 滑动中
    $scope.slide = function(event, index) {
        if (!sliding) return;

        currentX = event.clientX;
        var diff = currentX - startX;

        if (diff < 0) { // 向左滑动
            if (Math.abs(diff) > slideThreshold) {
                angular.element(event.currentTarget).addClass('slide-left');
            }
        }
        if (diff > 0) { // 向右滑动
            if (Math.abs(diff) > slideThreshold) {
                angular.element(event.currentTarget).removeClass('slide-left');
            }
        }
    };

    // 结束滑动
    $scope.endSlide = function(event, index) {
        sliding = false;
        angular.element(event.currentTarget).removeClass('sliding');
    };

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
        var groupedRecords = {};

        recordsToDisplay.forEach(function(record) {
            var dateKey = record.dateStr || new Date(record.date).toISOString().split('T')[0];
            if (!groupedRecords[dateKey]) {
                groupedRecords[dateKey] = [];
            }
            groupedRecords[dateKey].push(record);
        });

        var sortedDates = Object.keys(groupedRecords).sort().reverse();

        if (sortedDates.length === 0) {
            container.innerHTML = '<div class="no-results">没有找到匹配的记录。</div>';
            return;
        }

        sortedDates.forEach(function(date, index) {
            var dayTotal = groupedRecords[date].reduce(function(sum, record) {
                return sum + (parseFloat(record.amount) || 0);
            }, 0);

            var collapseId = 'collapse' + index;

            var accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';

            var header = document.createElement('h2');
            header.className = 'accordion-header';
            header.id = 'heading' + index;

            var button = document.createElement('button');
            button.className = 'accordion-button collapsed';
            button.type = 'button';
            button.setAttribute('data-bs-toggle', 'collapse');
            button.setAttribute('data-bs-target', '#' + collapseId);
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-controls', collapseId);
            button.textContent = date + ' (当日总计: ¥' + dayTotal.toFixed(2) + ')';

            header.appendChild(button);

            var collapseDiv = document.createElement('div');
            collapseDiv.id = collapseId;
            collapseDiv.className = 'accordion-collapse collapse';
            collapseDiv.setAttribute('aria-labelledby', 'heading' + index);
            collapseDiv.setAttribute('data-bs-parent', '#recordListContainer');

            var bodyDiv = document.createElement('div');
            bodyDiv.className = 'accordion-body';

            groupedRecords[date].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(function(record) {
                var recordTime = new Date(record.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false });
                var recordAmount = (parseFloat(record.amount) || 0).toFixed(2);
                var recordEvent = record.event || '(无内容)';

                var recordItemDiv = document.createElement('div');
                recordItemDiv.className = 'record-item';
                recordItemDiv.id = 'record-' + record.id;
                recordItemDiv.innerHTML =
                    '<div class="record-details">' +
                        '<div class="time">' + recordTime + '</div>' +
                        '<div class="event">' + recordEvent + '</div>' +
                    '</div>' +
                    '<div class="amount">¥' + recordAmount + '</div>' +
                    '<button class="btn btn-outline-danger btn-sm btn-delete-record">删除</button>';

                recordItemDiv.querySelector('.btn-delete-record').onclick = function() {
                    deleteHistoryRecord(record.id);
                };

                bodyDiv.appendChild(recordItemDiv);
            });

            collapseDiv.appendChild(bodyDiv);
            accordionItem.appendChild(header);
            accordionItem.appendChild(collapseDiv);
            container.appendChild(accordionItem);
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
                    console.log("记录已在界面更新");
                } else {
                    console.error("找不到本地记录数组来更新UI。");
                }
            };
            deleteRequest.onerror = function(event) {
                alert("删除数据库记录失败: " + event.target.error);
            };
        };
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