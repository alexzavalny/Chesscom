require 'httparty'
require 'json'
require 'date'

def fetch_today_stats(username)
  today = Date.today
  fetch_day_stats(username, today)
end

def fetch_yesterday_stats(username)
  yesterday = Date.today - 1
  fetch_day_stats(username, yesterday)
end

def fetch_month_stats(username)
  today = Date.today
  fetch_day_stats(username, today, true)
end

def fetch_day_stats(username, date, entire_month = false)
  url = "https://api.chess.com/pub/player/#{username}/games/#{date.year}/#{sprintf('%02d', date.month)}"
  response = HTTParty.get(url)

  return {} if response.code != 200

  month_games = response['games']
  stats_by_type = Hash.new { |hash, key| hash[key] = { played: 0, won: 0, lost: 0, draw: 0, total_time: 0 } }

  month_games.each do |game|
    game_date = Time.at(game['end_time']).to_date
    next unless entire_month || game_date == date

    game_type = game['time_class']
    stats = stats_by_type[game_type]
    stats[:played] += 1
    stats[:total_time] += get_total_time(game['pgn'])

    result_category = game_result(game, username).to_sym
    stats[result_category] += 1 if stats.key?(result_category)
  end

  stats_by_type
end

def display_stats_for(username, date_method)
  stats_by_type = send(date_method, username)
  puts "/#{username}/"

  total_played = 0
  total_won = 0
  total_lost = 0
  total_draw = 0
  total_time = 0
  
  stats_by_type.each do |game_type, stats|
    total_played += stats[:played]
    total_won += stats[:won]
    total_lost += stats[:lost]
    total_draw += stats[:draw]
    total_time += stats[:total_time]

    win_percent = stats[:played] > 0 ? (stats[:won].to_f / stats[:played] * 100).round(2) : 0
    lost_percent = stats[:played] > 0 ? (stats[:lost].to_f / stats[:played] * 100).round(2) : 0
    draw_percent = stats[:played] > 0 ? (stats[:draw].to_f / stats[:played] * 100).round(2) : 0
    total_time_formatted = format_duration(stats[:total_time])

    puts "  #{game_type.capitalize}: Played: #{stats[:played]}, Won: #{stats[:won]} (#{win_percent}%), Lost: #{stats[:lost]} (#{lost_percent}%), Draw: #{stats[:draw]} (#{draw_percent}%), Total Time: #{total_time_formatted}"
  end

  if stats_by_type.length > 1
    win_percent = total_played > 0 ? (total_won.to_f / total_played * 100).round(2) : 0
    lost_percent = total_played > 0 ? (total_lost.to_f / total_played * 100).round(2) : 0
    draw_percent = total_played > 0 ? (total_draw.to_f / total_played * 100).round(2) : 0
    total_time_formatted = format_duration(total_time)

    puts "  Total: Played: #{total_played}, Won: #{total_won} (#{win_percent}%), Lost: #{total_lost} (#{lost_percent}%), Draw: #{total_draw} (#{draw_percent}%), Time: #{total_time_formatted}"
  end

  puts
end

# ... [rest of your code remains unchanged] ...


def get_total_time(pgn)
  start_time_str = pgn.match(/\[StartTime \"(\d+:\d+:\d+)\"\]/)[1]
  end_time_str = pgn.match(/\[EndTime \"(\d+:\d+:\d+)\"\]/)[1]

  start_time = DateTime.parse(start_time_str).strftime('%s').to_i
  end_time = DateTime.parse(end_time_str).strftime('%s').to_i

  diff = end_time - start_time
  [diff, 0].max
end

def game_result(game, username)
  result_mapping = {
    'win' => 'won', 'checkmated' => 'lost', 'agreed' => 'draw', 
    'repetition' => 'draw', 'timeout' => 'lost', 'resigned' => 'lost', 
    'stalemate' => 'draw', 'lose' => 'lost', 'insufficient' => 'draw', 
    '50move' => 'draw', 'abandoned' => 'lost', 'kingofthehill' => 'lost', 
    'threecheck' => 'lost', 'timevsinsufficient' => 'draw', 
    'bughousepartnerlose' => 'lost'
  }

  if game['white']['username'].downcase == username.downcase
    result = game['white']['result']
  else
    result = game['black']['result']
  end

  result_mapping[result] || 'unknown'
end

def format_duration(seconds)
  hours = seconds / 3600
  minutes = (seconds % 3600) / 60
  seconds = seconds % 60
  "#{hours}h #{minutes}m #{seconds}s"
end

usernames = ['alexzavalny', 'jefimserg', 'TheErix', 'vadimostapchuk']

usernames = ['alexzavalny', 'jefimserg', 'TheErix', 'vadimostapchuk']
command = ARGV[0] # Gets the first command-line argument

case command
when "today"
  puts "Today Stats:"
  usernames.each { |username| display_stats_for(username, :fetch_today_stats) }
when "yesterday"
  puts "Yesterday Stats:"
  usernames.each { |username| display_stats_for(username, :fetch_yesterday_stats) }
when "both"
  puts "Today Stats:"
  usernames.each { |username| display_stats_for(username, :fetch_today_stats) }
  puts "Yesterday Stats:"
  usernames.each { |username| display_stats_for(username, :fetch_yesterday_stats) }
when "month"
  puts "Month Stats:"
  usernames.each { |username| display_stats_for(username, :fetch_month_stats) }
else
  puts "Invalid argument. Please use 'today', 'yesterday', or 'both'."
end