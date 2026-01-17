'use client';

interface PerformanceMetric {
  component: string;
  loadTime: number;
  dataSize: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000;
  private readonly SLOW_THRESHOLD = 3000;

  start(component: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const loadTime = performance.now() - startTime;
      
      const metric: PerformanceMetric = {
        component,
        loadTime,
        dataSize: 0,
        timestamp: Date.now(),
      };

      this.metrics.push(metric);
      
      if (this.metrics.length > this.MAX_METRICS) {
        this.metrics.shift();
      }

      if (loadTime > this.SLOW_THRESHOLD) {
        console.warn(`Slow load: ${component} took ${loadTime}ms`);
      }
    };
  }

  setDataSize(component: string, size: number) {
    const metric = this.metrics.find(m => m.component === component);
    if (metric) {
      metric.dataSize = size;
    }
  }

  getReport() {
    const components = [...new Set(this.metrics.map(m => m.component))];
    
    return components.map(component => {
      const componentMetrics = this.metrics.filter(m => m.component === component);
      const avgLoadTime = componentMetrics.reduce((sum, m) => sum + m.loadTime, 0) / componentMetrics.length;
      
      return {
        component,
        averageLoadTime: avgLoadTime,
        totalLoads: componentMetrics.length,
        slowLoads: componentMetrics.filter(m => m.loadTime > this.SLOW_THRESHOLD).length,
      };
    });
  }
}

export const performanceMonitor = new PerformanceMonitor();