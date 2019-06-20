FROM amazonlinux:latest

RUN curl -sL https://rpm.nodesource.com/setup_10.x | bash -
RUN yum -y install unzip aws-cli nodejs
ADD *.js /tmp/
ADD package* /tmp/
ADD grid-state.sh /tmp/grid-state.sh
ADD aws-grid-state.sh /tmp/aws-grid-state.sh
RUN cd /tmp/ && npm install
RUN chmod 755 /tmp/*.sh
WORKDIR /tmp
USER nobody

ENTRYPOINT ["/tmp/aws-grid-state.sh"]