FROM amazonlinux:latest

RUN curl -sL https://rpm.nodesource.com/setup_10.x | bash -
RUN yum -y install unzip aws-cli nodejs
ADD map-state.sh /tmp/map-state.sh
ADD geocode-grids /tmp/geocode-grids
RUN cd /tmp/geocode-grids && npm install
RUN chmod 755 /tmp/*.sh
WORKDIR /tmp
USER nobody

ENTRYPOINT ["/tmp/map-state.sh"]