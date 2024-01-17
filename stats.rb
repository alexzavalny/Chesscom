require 'httparty'
require 'json'
require 'date'

def fetch_today_stats(username)
  today = Date.today
  url = "https://api.chess.com/pub/player/#{username}/games/#{today.year}/#{sprintf('%02d', today.month)}"
  response = HTTParty.get(url)

  return {} if response.code != 200

  month_games = response['games']
  today_stats = { played: 0, won: 0, lost: 0, draw: 0, types: [], total_time: 0 }
  result_mapping = {
    'win' => 'won', 'checkmated' => 'lost', 'agreed' => 'draw', 
    'repetition' => 'draw', 'timeout' => 'lost', 'resigned' => 'lost', 
    'stalemate' => 'draw', 'lose' => 'lost', 'insufficient' => 'draw', 
    '50move' => 'draw', 'abandoned' => 'lost', 'kingofthehill' => 'lost', 
    'threecheck' => 'lost', 'timevsinsufficient' => 'draw', 
    'bughousepartnerlose' => 'lost'
  }

  month_games.each do |game|
    game_date = Time.at(game['end_time']).to_date
    next unless game_date == today

    today_stats[:played] += 1
    today_stats[:types] << game['time_class']
    today_stats[:total_time] += game['time_control'].to_i

    result_category = game_result(game, username, result_mapping).to_sym
    today_stats[result_category] += 1 if today_stats.key?(result_category)
  end

  today_stats
end

def game_result(game, username, result_mapping)
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
puts "Today Stats:"
usernames.each do |username|
  today_stats = fetch_today_stats(username)

  if today_stats.empty?
    puts "No data available for #{username}."
  else
    total_time_formatted = format_duration(today_stats[:total_time])
    puts "#{username}: Played: #{today_stats[:played]}, Won: #{today_stats[:won]}, Lost: #{today_stats[:lost]}, Draw: #{today_stats[:draw]}, Types: #{today_stats[:types].uniq}, Total Time: #{total_time_formatted}"
  end
end