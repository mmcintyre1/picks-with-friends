export type ScheduleGame = {
  id: string;
  league: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
};

export interface ScheduleProvider {
  listUpcomingGames(league: string, opts?: { commenceFrom?: Date; commenceTo?: Date }): Promise<ScheduleGame[]>;
}

export type ScheduleProviderErrorKind = "upstream_error";

export class ScheduleProviderError extends Error {
  constructor(
    public kind: ScheduleProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ScheduleProviderError";
  }
}
