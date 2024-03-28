# frozen_string_literal: true

require 'httparty'
require 'json'
require 'date'

# PlayerStats class to encapsulate player statistics fetching and calculation
class PlayerStats
  attr_reader :username

  def initialize(username)
    @username = username
  end

  def fetch_today_stats
    fetch_day_stats(Date.today)
  end

  def fetch_yesterday_stats
    fetch_day_stats(Date.today - 1)
  end

  def fetch_month_stats
    fetch_day_stats(Date.today, true)
  end

  private

  def fetch_day_stats(date, entire_month = false)
    url = "https://api.chess.com/pub/player/#{username}/games/#{date.year}/#{sprintf('%02d', date.month)}"
    response = HTTParty.get(url)

    return {} if response.code != 200

    month_games = response['games']
    stats_by_type = Hash.new { |hash, key| hash[key] = StatsByType.new }

    populate_stats(month_games, date, entire_month, stats_by_type)
    stats_by_type
  end

  def populate_stats(month_games, date, entire_month, stats_by_type)
    ratings_by_game_type = {}

    month_games.each do |game|
      game_date = Time.at(game['end_time']).to_date
      next unless entire_month || game_date == date

      game_type = game['time_class']
      stats = stats_by_type[game_type]
      stats.played += 1
      stats.total_time += get_total_time(game['pgn'])

      result_category = game_result(game).to_sym
      stats.increment_result(result_category)

      current_rating = game['white']['username'].downcase == username.downcase ? game['white']['rating'] : game['black']['rating']
      update_ratings_by_game_type(ratings_by_game_type, game_type, current_rating)
    end

    update_rating_changes(stats_by_type, ratings_by_game_type)
  end

  def update_rating_changes(stats_by_type, ratings_by_game_type)
    stats_by_type.each do |game_type, stats|
      stats.rating_change = ratings_by_game_type[game_type]&.rating_change
    end
  end

  def update_ratings_by_game_type(ratings_by_game_type, game_type, current_rating)
    ratings_by_game_type[game_type] ||= RatingsByGameType.new
    ratings_by_game_type[game_type].update(current_rating)
  end

  def get_total_time(pgn)
    start_time_str = pgn.match(/\[StartTime \"(\d+:\d+:\d+)\"\]/)[1]
    end_time_str = pgn.match(/\[EndTime \"(\d+:\d+:\d+)\"\]/)[1]

    start_time = DateTime.parse(start_time_str).strftime('%s').to_i
    end_time = DateTime.parse(end_time_str).strftime('%s').to_i

    diff = end_time - start_time
    [diff, 0].max
  end

  def game_result(game)
    result_mapping = {
      'win' => 'won', 'checkmated' => 'lost', 'agreed' => 'draw',
      'repetition' => 'draw', 'timeout' => 'lost', 'resigned' => 'lost',
      'stalemate' => 'draw', 'lose' => 'lost', 'insufficient' => 'draw',
      '50move' => 'draw', 'abandoned' => 'lost', 'kingofthehill' => 'lost',
      'threecheck' => 'lost', 'timevsinsufficient' => 'draw',
      'bughousepartnerlose' => 'lost'
    }

    result = if game['white']['username'].downcase == username.downcase
               game['white']['result']
             else
               game['black']['result']
             end

    result_mapping[result] || 'unknown'
  end
end

# StatsByType class to encapsulate game statistics by type
class StatsByType
  attr_accessor :played, :won, :lost, :draw, :total_time, :rating_change

  def initialize
    @played = 0
    @won = 0
    @lost = 0
    @draw = 0
    @total_time = 0
    @rating_change = nil
  end

  def increment_result(result)
    case result
    when :won
      @won += 1
    when :lost
      @lost += 1
    when :draw
      @draw += 1
    end
  end
end

# RatingsByGameType class to encapsulate rating changes by game type
class RatingsByGameType
  attr_reader :rating_change

  def initialize
    @first_game_rating = nil
    @last_game_rating = nil
  end

  def update(current_rating)
    @first_game_rating ||= current_rating
    @last_game_rating = current_rating
  end

  def rating_change
    return nil unless @first_game_rating && @last_game_rating

    "#{@first_game_rating} -> #{@last_game_rating}"
  end
end

# StatsRenderer class to handle rendering of statistics
class StatsRenderer
  def initialize(usernames)
    @usernames = usernames
  end

  def render_today_stats
    puts 'Today Stats:'
    render_stats_for(:fetch_today_stats)
  end

  def render_yesterday_stats
    puts 'Yesterday Stats:'
    render_stats_for(:fetch_yesterday_stats)
  end

  def render_month_stats
    puts 'Month Stats:'
    render_stats_for(:fetch_month_stats)
  end

  private

  def render_stats_for(stats_method)
    @usernames.each do |username|
      player_stats = PlayerStats.new(username)
      stats_by_type = player_stats.send(stats_method)
      render_player_stats(username, stats_by_type)
    end
  end

  def render_player_stats(username, stats_by_type)
    puts "/#{username}/"

    total_played = 0
    total_won = 0
    total_lost = 0
    total_draw = 0
    total_time = 0

    stats_by_type.each do |game_type, stats|
      total_played += stats.played
      total_won += stats.won
      total_lost += stats.lost
      total_draw += stats.draw
      total_time += stats.total_time if game_type != 'daily'

      win_percent = stats.played.positive? ? (stats.won.to_f / stats.played * 100).round(2) : 0
      lost_percent = stats.played.positive? ? (stats.lost.to_f / stats.played * 100).round(2) : 0
      draw_percent = stats.played.positive? ? (stats.draw.to_f / stats.played * 100).round(2) : 0
      total_time_formatted = format_duration(stats.total_time)

      time_string = game_type != 'daily' ? ", Total Time: #{total_time_formatted}" : ''
      rating_change_string = stats.rating_change.nil? ? '' : ", Rating [#{stats.rating_change}]"

      puts "  #{game_type.capitalize}: Played: #{stats.played}, Won: #{stats.won} (#{win_percent}%), Lost: #{stats.lost} (#{lost_percent}%), Draw: #{stats.draw} (#{draw_percent}%)#{time_string}#{rating_change_string}"
    end

    if stats_by_type.empty?
      puts '  No games. Something is wrong.'
    elsif stats_by_type.length > 1
      win_percent = total_played.positive? ? (total_won.to_f / total_played * 100).round(2) : 0
      lost_percent = total_played.positive? ? (total_lost.to_f / total_played * 100).round(2) : 0
      draw_percent = total_played.positive? ? (total_draw.to_f / total_played * 100).round(2) : 0
      total_time_formatted = format_duration(total_time)

      puts "  Total: Played: #{total_played}, Won: #{total_won} (#{win_percent}%), Lost: #{total_lost} (#{lost_percent}%), Draw: #{total_draw} (#{draw_percent}%), Time: #{total_time_formatted}"
    end

    puts
  end
end

# Hardcoded usernames
USERNAMES = ['alexandrzavalnij', 'jefimserg', 'TheErix', 'vadimostapchuk']

# Execute the program based on command-line arguments
stats_renderer = StatsRenderer.new(USERNAMES)

command = ARGV[0] || 'today'

case command
when 'today'
  stats_renderer.render_today_stats
when 'yesterday'
  stats_renderer.render_yesterday_stats
when 'month'
  stats_renderer.render_month_stats
else
  puts "Invalid argument. Please use 'today', 'yesterday', or 'month'."
end
