<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { createChart, ColorType, LineSeries } from "lightweight-charts";

    export let data: { time: number; value: number }[] = [];
    export let title: string = "Chart";
    export let color: string = "#2962FF";
    export let height: number = 300;

    let chartContainer: HTMLElement;
    let chart: any;
    let series: any;

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

        // V5 API: chart.addSeries(SeriesType, options)
        series = chart.addSeries(LineSeries, {
            color: color,
            lineWidth: 2,
        });

        if (data.length > 0) {
            // Dedup by time (seconds) and sort - REQUIRED by Lightweight Charts
            const timeMap = new Map();
            data.forEach((item) => {
                timeMap.set(item.time, item.value);
            });

            const sortedData = Array.from(timeMap.entries())
                .map(([time, value]) => ({
                    time: time as number,
                    value: value as number,
                }))
                .sort((a, b) => a.time - b.time);

            series.setData(sortedData);
            chart.timeScale().fitContent();
        }

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

    $: if (chart && series && data) {
        const timeMap = new Map();
        data.forEach((item) => {
            timeMap.set(item.time, item.value);
        });

        const sortedData = Array.from(timeMap.entries())
            .map(([time, value]) => ({
                time: time as number,
                value: value as number,
            }))
            .sort((a, b) => a.time - b.time);

        if (sortedData.length > 0) {
            series.setData(sortedData);
            chart.timeScale().fitContent();
        }
    }
</script>

<div class="chart-wrapper">
    <h4>{title}</h4>
    <div class="chart-container" bind:this={chartContainer}></div>
</div>

<style>
    .chart-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
        background: var(--color-bg, #fff);
        border-radius: 12px;
        padding: 1rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    h4 {
        margin: 0;
        font-size: 0.9rem;
        color: var(--color-text-secondary, #666);
    }

    .chart-container {
        width: 100%;
        position: relative;
    }
</style>
