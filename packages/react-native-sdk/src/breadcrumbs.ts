import { Breadcrumb } from './types';

export class BreadcrumbTracker {
  private buffer: Breadcrumb[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  add(crumb: Omit<Breadcrumb, 'timestamp'> & { timestamp?: number }): void {
    const breadcrumb: Breadcrumb = {
      timestamp: crumb.timestamp ?? Date.now(),
      category: crumb.category,
      message: crumb.message,
      level: crumb.level,
      data: crumb.data,
    };

    this.buffer.push(breadcrumb);

    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }
  }

  getAll(): Breadcrumb[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}
