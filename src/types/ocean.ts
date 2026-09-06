export type OceanVariable = "temperature" | "salinity" | "currents";
export type OceanRegion = "bob" | "arabian" | "indian" | "tn" | "andaman";
export type PlatformType = "argo" | "buoy" | "ship";

export interface CommonFilterParams {
  variable: OceanVariable;
  region?: OceanRegion | null;
  depth?: number | null;
  station_id?: string | null;
  platform?: PlatformType | null;
  start_date?: string | null;
  end_date?: string | null;
  date?: string | null;
}
export interface HealthResponse { status: string; service: string; version: string; data_mode: string; message: string; }
export interface VariableInfo { key: OceanVariable; label: string; unit: string; good_below: number; moderate_below: number; }
export interface RegionInfoDto { key: OceanRegion; label: string; bbox: Record<string, number>; blurb: string; }
export interface StationDto { station_id: string; name: string; platform: PlatformType; platform_label: string; latitude: number; longitude: number; region: OceanRegion; depths_m: number[]; qc: string; status: string; last_updated: string; }
export interface OceanDataPoint { latitude: number; longitude: number; depth_m: number; timestamp: string; variable: OceanVariable; value: number; unit: string; region: OceanRegion; direction_deg?: number | null; }
export interface ObservationRecord { id: string; station_id: string; station_name: string; platform: PlatformType; latitude: number; longitude: number; depth_m: number; timestamp: string; variable: OceanVariable; observed_value: number; unit: string; quality_flag: string; region: OceanRegion; }
export interface ComparisonRecord { station_id: string; station_name: string; platform: PlatformType; latitude: number; longitude: number; depth_m: number; timestamp: string; variable: OceanVariable; model_value: number; observed_value: number; difference: number; absolute_error: number; agreement_status: "good" | "moderate" | "high"; unit: string; quality_flag: string; region: OceanRegion; }
export interface ValidationMetricsApi { variable: OceanVariable; region: OceanRegion | null; depth_m: number | null; start_date: string | null; end_date: string | null; mean_absolute_error: number; root_mean_square_error: number; mean_bias: number; centred_rmse: number; correlation_r: number | null; observation_coverage_percent: number; record_count: number; applicable_count: number; good_agreement_count: number; moderate_agreement_count: number; high_deviation_count: number; unit: string; interpretation: string; }
export interface DataSourceApi { id: string; name: string; source_type: string; format: string; variables: string[]; update_frequency: string; platform_description: string; spatial_coverage: string; quality_control: string; data_status: string; record_count: number; last_updated: string; is_sample_data: boolean; description: string; metadata: Array<{ label: string; value: string }>; }
export interface DepthProfilePoint { depth_m: number; model_value: number | null; observed_value: number | null; unit: string; n_observations: number; }
export interface DepthProfileResponse { variable: OceanVariable; station_id: string | null; region: OceanRegion | null; date: string | null; points: DepthProfilePoint[]; }
export interface TimeSeriesPointApi { timestamp: string; model_value: number | null; observed_value: number | null; unit: string; n_observations: number; }
export interface TimeSeriesResponse { variable: OceanVariable; station_id: string | null; region: OceanRegion | null; depth_m: number | null; points: TimeSeriesPointApi[]; }
export interface Insight { title: string; severity: "low" | "medium" | "high"; message: string; supporting_metric: string; recommendation: string; }
export interface InsightsResponse { variable: OceanVariable; region: OceanRegion | null; depth_m: number | null; insights: Insight[]; }
