(function initAdminCharts(global) {
  let statusChart = null;
  let trendChart = null;

  const STATUS_LABELS = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  };

  const STATUS_COLORS = {
    pending: '#fcd34d',
    confirmed: '#93c5fd',
    preparing: '#c4b5fd',
    out_for_delivery: '#67e8f9',
    delivered: '#86efac',
    cancelled: '#fca5a5'
  };

  function buildStatusData(orders) {
    const counts = {};

    for (const order of orders) {
      const status = order.status || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
    }

    const statuses = Object.keys(counts);
    return {
      labels: statuses.map((status) => STATUS_LABELS[status] || status),
      data: statuses.map((status) => counts[status]),
      colors: statuses.map((status) => STATUS_COLORS[status] || '#94a3b8')
    };
  }

  function buildTrendData(orders) {
    const now = new Date();
    const dailyTotals = {};

    for (let offset = 29; offset >= 0; offset -= 1) {
      const current = new Date(now);
      current.setDate(current.getDate() - offset);
      dailyTotals[current.toISOString().slice(0, 10)] = 0;
    }

    for (const order of orders) {
      if (!order.created_at) continue;
      const dayKey = new Date(order.created_at).toISOString().slice(0, 10);
      if (Object.prototype.hasOwnProperty.call(dailyTotals, dayKey)) {
        dailyTotals[dayKey] += parseFloat(order.total_amount || 0);
      }
    }

    const labels = Object.keys(dailyTotals).map((dayKey) => {
      const date = new Date(`${dayKey}T00:00:00`);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      data: Object.values(dailyTotals)
    };
  }

  function renderStatusChart(orders) {
    const canvas = document.getElementById('admin-chart-orders-status');
    if (!canvas || typeof Chart === 'undefined') return;

    const { labels, data, colors } = buildStatusData(orders);

    if (statusChart) {
      statusChart.data.labels = labels;
      statusChart.data.datasets[0].data = data;
      statusChart.data.datasets[0].backgroundColor = colors;
      statusChart.update();
      return;
    }

    statusChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { size: 11 },
              boxWidth: 12
            }
          }
        }
      }
    });
  }

  function renderTrendChart(orders) {
    const canvas = document.getElementById('admin-chart-revenue-trend');
    if (!canvas || typeof Chart === 'undefined') return;

    const { labels, data } = buildTrendData(orders);

    if (trendChart) {
      trendChart.data.labels = labels;
      trendChart.data.datasets[0].data = data;
      trendChart.update();
      return;
    }

    trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue (PHP)',
          data,
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.15)',
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `PHP ${Number(context.raw || 0).toLocaleString('en-PH', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 7,
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: 10 },
              callback(value) {
                return `PHP ${Number(value).toLocaleString('en-PH')}`;
              }
            }
          }
        }
      }
    });
  }

  global.AdminCharts = {
    update(orders) {
      const safeOrders = Array.isArray(orders) ? orders : [];
      renderStatusChart(safeOrders);
      renderTrendChart(safeOrders);
    }
  };
})(window);// admin-charts.js — Chart.js helpers for the admin dashboard
// Depends on Chart.js 4.4.1 CDN being loaded before this file.
// Exports window.AdminCharts for use by admin.js

(function () {
    'use strict';

    if (typeof Chart === 'undefined') return; // Chart.js not loaded yet; will be retried by init

    const COLOR_STATUS = {
        pending:          '#fcd34d',
        confirmed:        '#93c5fd',
        preparing:        '#c4b5fd',
        out_for_delivery: '#67e8f9',
        delivered:        '#86efac',
        cancelled:        '#fca5a5',
        disabled:         '#d1d5db'
    };

    const LABEL_STATUS = {
        pending:          'Pending',
        confirmed:        'Confirmed',
        preparing:        'Preparing',
        out_for_delivery: 'Out for Delivery',
        delivered:        'Delivered',
        cancelled:        'Cancelled',
        disabled:         'Disabled'
    };

    let _ordersChart = null;
    let _revenueChart = null;

    /**
     * Render or update the Orders-by-Status donut chart.
     * @param {Array} orders — array of order objects from /api/admin/orders
     */
    function renderOrdersStatusChart(orders) {
        const canvas = document.getElementById('admin-chart-orders-status');
        if (!canvas) return;

        // Tally counts per status
        const counts = {};
        for (const order of orders) {
            const key = order.is_disabled ? 'disabled' : (order.status || 'pending');
            counts[key] = (counts[key] || 0) + 1;
        }

        const keys    = Object.keys(counts);
        const labels  = keys.map(k => LABEL_STATUS[k] || k);
        const data    = keys.map(k => counts[k]);
        const colors  = keys.map(k => COLOR_STATUS[k] || '#6b7280');

        const cfg = {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                                return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        };

        if (_ordersChart) {
            _ordersChart.data.labels               = cfg.data.labels;
            _ordersChart.data.datasets[0].data     = cfg.data.datasets[0].data;
            _ordersChart.data.datasets[0].backgroundColor = cfg.data.datasets[0].backgroundColor;
            _ordersChart.update();
        } else {
            _ordersChart = new Chart(canvas, cfg);
        }
    }

    /**
     * Render or update the Revenue Trend line chart.
     * Aggregates delivered order totals by date for the last 30 days.
     * @param {Array} orders — array of order objects from /api/admin/orders
     */
    function renderRevenueTrendChart(orders) {
        const canvas = document.getElementById('admin-chart-revenue-trend');
        if (!canvas) return;

        // Build last-30-days date labels
        const now = new Date();
        const days = 30;
        const labels = [];
        const dayMap = {};

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
            labels.push(key.slice(5)); // 'MM-DD'
            dayMap[key] = 0;
        }

        // Sum delivered revenue per day
        const deliveredOrders = orders.filter(o => o.status === 'delivered' && !o.is_disabled);
        for (const order of deliveredOrders) {
            const dateKey = (order.created_at || '').slice(0, 10);
            if (dateKey in dayMap) {
                dayMap[dateKey] += parseFloat(order.total_amount || 0);
            }
        }

        const dataPoints = Object.values(dayMap);

        const cfg = {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Revenue (₱)',
                    data: dataPoints,
                    borderColor: '#4ade80',
                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 10,
                            font: { size: 10 }
                        },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: 10 },
                            callback(v) {
                                return v >= 1000 ? `₱${(v / 1000).toFixed(1)}k` : `₱${v}`;
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(ctx) {
                                return ` ₱${ctx.raw.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        };

        if (_revenueChart) {
            _revenueChart.data.labels                    = cfg.data.labels;
            _revenueChart.data.datasets[0].data          = cfg.data.datasets[0].data;
            _revenueChart.update();
        } else {
            _revenueChart = new Chart(canvas, cfg);
        }
    }

    /**
     * Main entry point — call after orders array is loaded.
     * @param {Array} orders
     */
    function update(orders) {
        if (typeof Chart === 'undefined') return;
        renderOrdersStatusChart(orders);
        renderRevenueTrendChart(orders);
    }

    /**
     * Destroy both charts (e.g. before a full data refresh).
     */
    function destroy() {
        if (_ordersChart)  { _ordersChart.destroy();  _ordersChart  = null; }
        if (_revenueChart) { _revenueChart.destroy(); _revenueChart = null; }
    }

    window.AdminCharts = { update, destroy };
})();

// ─── ApexCharts helpers (used directly by AdminDashboard) ─────────────────────
// These are standalone — AdminDashboard calls new ApexCharts() directly in its
// loadReportsChart() and renderFarmersAnalyticsChart() methods.
// This file keeps Chart.js legacy charts intact above.
