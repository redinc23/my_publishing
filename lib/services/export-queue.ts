
import { createClient } from '@/lib/supabase/server';

interface ExportJob {
  id: string;
  type: 'analytics' | 'revenue' | 'readers';
  bookId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dateRange: any;
  format: 'csv' | 'json' | 'excel';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  userId: string;
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class ExportQueueService {
  private supabase!: Awaited<ReturnType<typeof createClient>>;
  private readonly MAX_CONCURRENT_JOBS = 3;
  private activeJobs = new Set<string>();
  private isProcessing = false;

  private constructor() {}

  static async create(): Promise<ExportQueueService> {
    const instance = new ExportQueueService();
    instance.supabase = await createClient();
    instance.startProcessor();
    return instance;
  }

  async createJob(
    type: ExportJob['type'],
    bookId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dateRange: any,
    format: ExportJob['format'],
    userId: string
  ): Promise<string> {
    const { data: job, error } = await this.supabase
      .from('export_jobs')
      .insert({
        type,
        book_id: bookId,
        date_range: dateRange,
        format,
        user_id: userId,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    // Trigger processing
    this.processQueue();

    return job.id;
  }

  async getJobStatus(jobId: string): Promise<ExportJob | null> {
    const supabase = await this.supabase;
    const { data: job, error } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) return null;
    return job;
  }

  async getUserJobs(userId: string): Promise<ExportJob[]> {
    const { data: jobs, error } = await this.supabase
      .from('export_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return [];
    return jobs;
  }

  private async startProcessor(): Promise<void> {
    setInterval(() => this.processQueue(), 10000); // Check every 10 seconds
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeJobs.size >= this.MAX_CONCURRENT_JOBS) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get pending jobs
      const { data: pendingJobs, error } = await this.supabase
        .from('export_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(this.MAX_CONCURRENT_JOBS - this.activeJobs.size);

      if (error || !pendingJobs) return;

      for (const job of pendingJobs) {
        if (this.activeJobs.has(job.id)) continue;

        this.activeJobs.add(job.id);
        this.processJob(job).finally(() => {
          this.activeJobs.delete(job.id);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: ExportJob): Promise<void> {
    try {
      // Update status to processing
      await this.supabase
        .from('export_jobs')
        .update({
          status: 'processing',
          progress: 10,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Generate export based on type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any;

      switch (job.type) {
        case 'analytics':
          result = await this.exportAnalytics(job);
          break;
        case 'revenue':
          result = await this.exportRevenue(job);
          break;
        case 'readers':
          result = await this.exportReaders(job);
          break;
        default:
          throw new Error(`Unknown export type: ${job.type}`);
      }

      // Update progress to 90%
      await this.supabase
        .from('export_jobs')
        .update({
          progress: 90,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Upload to storage
      const fileUrl = await this.uploadToStorage(job, result);

      // Mark as completed
      await this.supabase
        .from('export_jobs')
        .update({
          status: 'completed',
          progress: 100,
          result_url: fileUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Send notification
      await this.sendNotification(job, fileUrl);

    } catch (error) {
      console.error(`Export job ${job.id} failed:`, error);

      await this.supabase
        .from('export_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }

  private async exportAnalytics(job: ExportJob): Promise<string> {
    // Implementation from export-data.ts
    const { exportAnalyticsData } = await import('@/lib/actions/export-data');
    const result = await exportAnalyticsData(
      job.bookId,
      job.dateRange,
      job.format
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Export failed');
    }

    return typeof result.data === 'string' ? result.data : String(result.data);
  }

  private async exportRevenue(job: ExportJob): Promise<string> {
    const { exportRevenueData } = await import('@/lib/actions/export-data');
    const result = await exportRevenueData(job.bookId, job.dateRange, job.format);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Export failed');
    }

    return typeof result.data === 'string' ? result.data : String(result.data);
  }

  private async exportReaders(job: ExportJob): Promise<string> {
    const { exportReaderData } = await import('@/lib/actions/export-data');
    const result = await exportReaderData(job.bookId, job.dateRange);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Export failed');
    }

    return typeof result.data === 'string' ? result.data : String(result.data);
  }

  private async uploadToStorage(job: ExportJob, data: string): Promise<string> {
    const fileName = `${job.type}-${job.bookId}-${Date.now()}.${job.format}`;
    const filePath = `exports/${job.userId}/${fileName}`;

    const { error } = await this.supabase.storage
      .from('exports')
      .upload(filePath, new Blob([data]), {
        contentType: this.getContentType(job.format),
        upsert: true,
      });

    if (error) throw error;

    // Generate signed URL (valid for 24 hours)
    const { data: signedUrl } = await this.supabase.storage
      .from('exports')
      .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours

    return signedUrl?.signedUrl || '';
  }

  private getContentType(format: string): string {
    switch (format) {
      case 'csv': return 'text/csv';
      case 'json': return 'application/json';
      case 'excel': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default: return 'text/plain';
    }
  }

  private async sendNotification(job: ExportJob, fileUrl: string): Promise<void> {
    const { data: user } = await this.supabase
      .from('users')
      .select('email, name')
      .eq('id', job.userId)
      .single();

    if (!user?.email) return;

    // Send email notification
    // Implementation depends on your email service
    console.log(`Export ready for ${user.email}: ${fileUrl}`);
  }

  async cleanupOldExports(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete old jobs
    await this.supabase
      .from('export_jobs')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    // Cleanup storage (optional)
    // This would require listing files in storage bucket
  }
}

// Export a promise that resolves to the instance
export const exportQueue = ExportQueueService.create();