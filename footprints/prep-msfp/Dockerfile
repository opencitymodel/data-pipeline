FROM amazonlinux:latest

RUN curl -sL https://rpm.nodesource.com/setup_10.x | bash -
RUN yum -y install unzip aws-cli nodejs
ADD process-state.sh /tmp/process-state.sh
ADD download-and-prep.sh /tmp/download-and-prep.sh
ADD ../grid-and-attrs /tmp/grid-and-attrs
RUN cd /tmp/grid-and-attrs && npm install
RUN chmod 755 /tmp/*.sh
WORKDIR /tmp
USER nobody

ENTRYPOINT ["/tmp/process-state.sh"]