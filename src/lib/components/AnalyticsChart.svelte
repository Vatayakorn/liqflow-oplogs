<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        createChart,
        ColorType,
        LineSeries,
        AreaSeries,
    } from "lightweight-charts";

    export let seriesData: {
        label: string;
        color: string;
        data: { time: number; value: number }[];
        type?: "line" | "area"; // Support both
    }[] = [];
    export let title: string = "Analytics Chart";
    export let height: number = 400;
    export let isLoading: boolean = false;

    let chartContainer: HTMLElement;
    let chart: any;
    let seriesInstances: any[] = [];

    onMount(() => {
        if (!chartContainer) return;

        chart = createChart(chartContainer, {
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#64748b",
                fontFamily: "Inter, sans-serif",
            },
            width: chartContainer.clientWidth,
            height: height,
            grid: {
                vertLines: { color: "rgba(148, 163, 184, 0.1)" },
                horzLines: { color: "rgba(148, 163, 184, 0.1)" },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: "rgba(148, 163, 184, 0.2)",
                tickMarkFormatter: (time: number) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                    });
                },
            },
            rightPriceScale: {
                borderColor: "rgba(148, 163, 184, 0.2)",
                autoScale: true,
            },
            crosshair: {
                mode: 0,
                vertLine: {
                    width: 1,
                    color: "rgba(148, 163, 184, 0.5)",
                    style: 2,
                },
                horzLine: {
                    width: 1,
                    color: "rgba(148, 163, 184, 0.5)",
                    style: 2,
                },
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,
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
            const isArea =
                s.type === "area" ||
                (seriesData.length === 1 &&
                    s.label.toLowerCase().includes("prefund"));
            const SeriesClass = isArea ? AreaSeries : LineSeries;

            const options: any = {
                color: s.color,
                lineWidth: 2,
                title: s.label,
            };

            if (isArea) {
                options.lineColor = s.color;
                options.topColor = `${s.color}44`;
                options.bottomColor = `${s.color}05`;
            }

            const instance = chart.addSeries(SeriesClass, options);

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
    <div class="chart-container-relative">
        <div class="chart-container" bind:this={chartContainer}></div>
        {#if isLoading}
            <div class="loading-overlay">
                <div class="shimmer"></div>
            </div>
        {/if}
    </div>
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

    .chart-container-relative {
        width: 100%;
        position: relative;
    }

    .chart-container {
        width: 100%;
        position: relative;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        border-radius: 8px;
        overflow: hidden;
    }

    .shimmer {
        width: 100%;
        height: 100%;
        background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite linear;
    }

    @keyframes shimmer {
        0% {
            background-position: 200% 0;
        }
        100% {
            background-position: -200% 0;
        }
    }
</style>
