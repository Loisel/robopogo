export interface GameConfig {
  id: number;
  mode: string;
  mapfile: string;
  map_info: any;
  startinglocs: any;
  player_ids: number[];
  player_names: string[];
  player_colors: string[];
  player_teams: number[];
  player_ready: boolean[];
  creator_userid: number;
  caller_idx: number;
  caller_id: number;
  player_color_choices: string[];
  all_ready: boolean;
}
