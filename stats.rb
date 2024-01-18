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

def fetch_day_stats(username, date)
  url = "https://api.chess.com/pub/player/#{username}/games/#{date.year}/#{sprintf('%02d', date.month)}"
  response = HTTParty.get(url)

  return {} if response.code != 200

  month_games = response['games']
  today_stats = { played: 0, won: 0, lost: 0, draw: 0, types: [], total_time: 0 }

  month_games.each do |game|
    game_date = Time.at(game['end_time']).to_date
    next unless game_date == date

    today_stats[:played] += 1
    today_stats[:types] << game['time_class']
    today_stats[:total_time] += get_total_time(game['pgn'])

    result_category = game_result(game, username).to_sym
    today_stats[result_category] += 1 if today_stats.key?(result_category)
  end

  today_stats
end

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



def display_stats_for(username, date_label, date_method)
  stats = send(date_method, username)
  total_time_formatted = format_duration(stats[:total_time])
  puts "#{username}: #{date_label} - Played: #{stats[:played]}, Won: #{stats[:won]}, Lost: #{stats[:lost]}, Draw: #{stats[:draw]}, Types: #{stats[:types].uniq}, Total Time: #{total_time_formatted}"
  puts
end

usernames = ['alexzavalny', 'jefimserg', 'TheErix', 'vadimostapchuk']
command = ARGV[0] # Gets the first command-line argument

case command
when "today"
  puts "Today Stats:"
  usernames.each { |username| display_stats_for(username, "Today", :fetch_today_stats) }
when "yesterday"
  puts "Yesterday Stats:"
  usernames.each { |username| display_stats_for(username, "Yesterday", :fetch_yesterday_stats) }
when "both"
  puts "Today Stats:"
  usernames.each { |username| display_stats_for(username, "Today", :fetch_today_stats) }
  puts "Yesterday Stats:"
  usernames.each { |username| display_stats_for(username, "Yesterday", :fetch_yesterday_stats) }
else
  puts "Invalid argument. Please use 'today', 'yesterday', or 'both'."
end