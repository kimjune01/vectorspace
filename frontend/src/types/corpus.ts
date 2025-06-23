export interface HNRecommendation {
  title: string;
  url: string;
  score: number;
  timestamp: string;
}

export interface HNRecommendationsResponse {
  recommendations: HNRecommendation[];
}