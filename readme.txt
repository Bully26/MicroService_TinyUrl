Currently the 
mongodb , mongo express , rabbit mq doesnt have auth so set it up if you need

before running docker compose 
build following image 
by using following running following command in root directoty

docker build -t read -f read_serice/dockerfile .
docker build -t write -f write_que/dockerfile .
docker build -t worker -f write_dbq/dockerfile .
docker build -t gateway -f gateway/dockerfile .

then run 
docker compose up

<-NOW YOU CAN ACCESS THE GATEWAY SERVICE THROUGH localhost:3000->