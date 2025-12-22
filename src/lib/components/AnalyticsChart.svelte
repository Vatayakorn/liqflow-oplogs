<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { createChart, ColorType, LineSeries } from "lightweight-charts";

    export let seriesData: {
        label: string;
        color: string;
        data: { time: number; value: number }[];
    }[] = [];
    export let title: string = "Analytics Chart";
    export let height: number = 400;

    let chartContainer: HTMLElement;
    let chart: any;
    let seriesInstances: any[] = [];

    onMount(() => {
        if (!chartContainer) return;

        chart = createChart(chartContainer, {
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#333",
            },
            width: chartContainer.clientWidth,
            height: height,
            grid: {
                vertLines: { color: "rgba(197, 203, 206, 0.5)" },
                horzLines: { color: "rgba(197, 203, 206, 0.5)" },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        updateChartData();
        window.addEventListener("resize", handleResize);
    });

    onDestroy(() => {
        window.removeEventListener("resize", handleResize);
        if (chart) {
            chart.remove();
        }
    });

    function handleResize() {
        if (chart && chartContainer) {
            chart.applyOptions({ width: chartContainer.clientWidth });
        }
    }

    function updateChartData() {
        if (!chart) return;

        // Clear existing series
        seriesInstances.forEach((s) => chart.removeSeries(s));
        seriesInstances = [];

        seriesData.forEach((s) => {
            const instance = chart.addSeries(LineSeries, {
                color: s.color,
                lineWidth: 2,
                title: s.label,
            });

            const timeMap = new Map();
            s.data.forEach((item) => {
                timeMap.set(item.time, item.value);
            });

            const sortedData = Array.from(timeMap.entries())
                .map(([time, value]) => ({
                    time: time as number,
                    value: value as number,
                }))
                .sort((a, b) => a.time - b.time);

            if (sortedData.length > 0) {
                instance.setData(sortedData);
            }
            seriesInstances.push(instance);
        });

        chart.timeScale().fitContent();
    }

    $: if (chart && seriesData) {
        updateChartData();
    }
</script>

<div class="analytics-chart-wrapper">
    <div class="chart-header">
        <h4>{title}</h4>
        <div class="legend">
            {#each seriesData as s}
                <div class="legend-item">
                    <span class="dot" style="background: {s.color}"></span>
                    <span>{s.label}</span>
                </div>
            {/each}
        </div>
    </div>
    <div class="chart-container" bind:this={chartContainer}></div>
</div>

<style>
    .analytics-chart-wrapper {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
        background: var(--color-bg, #fff);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--color-separator, #eee);
    }

    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    h4 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--color-text);
        letter-spacing: -0.01em;
    }

    .legend {
        display: flex;
        gap: 1rem;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text-secondary);
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .chart-container {
        width: 100%;
        position: relative;
    }
</style>
